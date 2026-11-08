from __future__ import annotations

import hmac
from typing import Protocol

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import Conflict, InvalidInput, NotFound, TooManyAttempts
from app.core.passwords import (NOTE_MAX, check_email, check_name_part, check_username, check_wifi_password,
                                clean_text, nt_hash)

ID_LABEL = "Student ID / Faculty ID"
EMAIL_TAKEN = "That UMindanao email already belongs to another Wi-Fi user."
from app.db.models import WifiUser, now
from app.repositories.activity import ActivityRepository
from app.repositories.admins import WifiSessionRepository
from app.repositories.wifi_users import StatusFilter, WifiUserRepository
from app.services.radius_export import RadiusUsersExporter


class PasswordGuessThrottle(Protocol):
    def seconds_locked(self, username: str) -> int: ...
    def failed(self, username: str) -> None: ...
    def succeeded(self, username: str) -> None: ...


MAX_EXPIRY_SECONDS = 10 * 365 * 86400


class _Unset:
    """Marks 'field not sent' in updates, so None can mean 'clear the expiry'."""


UNSET = _Unset()


def check_expiry(expires_at: int | None) -> int | None:
    if expires_at is None:
        return None
    if isinstance(expires_at, bool) or not isinstance(expires_at, int):
        raise InvalidInput("Expiry must be a date and time.")
    current = now()
    if expires_at <= current:
        raise InvalidInput("The expiry must be in the future.")
    if expires_at > current + MAX_EXPIRY_SECONDS:
        raise InvalidInput("The expiry can be at most 10 years away.")
    return expires_at


class WifiUserService:
    def __init__(self, db: Session, exporter: RadiusUsersExporter):
        self.db = db
        self.users = WifiUserRepository(db)
        self.activity = ActivityRepository(db)
        self.exporter = exporter

    def list(self, search: str = "", status: StatusFilter = "all") -> list[WifiUser]:
        return self.users.list(search.strip()[:64], status)

    def get(self, username: str) -> WifiUser:
        user = self.users.get(username)
        if user is None:
            raise NotFound(f"No Wi-Fi user with ID '{username}'.")
        return user

    def create(self, actor: str, username: str, password: str, first_name: str, last_name: str, email: str,
               note: str = "", expires_at: int | None = None) -> WifiUser:
        """username is the person's Student ID or Faculty ID."""
        username = (username or "").strip().lower()
        check_username(username, ID_LABEL)
        user = WifiUser(
            username=username,
            first_name=check_name_part(first_name, "First name"),
            last_name=check_name_part(last_name, "Last name"),
            email=check_email(email),
            note=clean_text(note, "Note", NOTE_MAX),
            nt_hash=nt_hash(password),
            enabled=True,
            expires_at=check_expiry(expires_at),
        )
        if self.users.get(username) is not None:
            raise Conflict(f"A Wi-Fi user with ID '{username}' already exists.")
        if self.users.get_by_email(user.email) is not None:
            raise Conflict(EMAIL_TAKEN)
        self.users.add(user)
        self.activity.add(actor, "wifi.create", username)
        self._commit(f"A Wi-Fi user with ID '{username}' or that email already exists.", radius_changed=True)
        return user

    def update(self, actor: str, username: str, *, first_name: str | None = None, last_name: str | None = None,
               email: str | None = None, note: str | None = None, enabled: bool | None = None,
               expires_at: int | None | _Unset = UNSET) -> WifiUser:
        user = self.get(username)
        if first_name is not None:
            user.first_name = check_name_part(first_name, "First name")
        if last_name is not None:
            user.last_name = check_name_part(last_name, "Last name")
        if email is not None:
            new_email = check_email(email)
            other = self.users.get_by_email(new_email)
            if other is not None and other.id != user.id:
                raise Conflict(EMAIL_TAKEN)
            user.email = new_email
        if note is not None:
            user.note = clean_text(note, "Note", NOTE_MAX)
        toggled = enabled is not None and enabled != user.enabled
        if toggled:
            user.enabled = enabled
        expiry_changed = not isinstance(expires_at, _Unset) and expires_at != user.expires_at
        if expiry_changed:
            user.expires_at = check_expiry(expires_at)  # type: ignore[arg-type]
        user.updated_at = now()

        if toggled:
            action = "wifi.enable" if enabled else "wifi.disable"
        elif expiry_changed:
            action = "wifi.expiry_clear" if user.expires_at is None else "wifi.expiry"
        else:
            action = "wifi.update"
        self.activity.add(actor, action, username)
        self._commit(EMAIL_TAKEN, radius_changed=toggled or expiry_changed)
        return user

    def set_password(self, actor: str, username: str, password: str) -> None:
        user = self.get(username)
        user.nt_hash = nt_hash(password)
        user.updated_at = now()
        self.activity.add(actor, "wifi.password", username)
        self._commit("Could not save.", radius_changed=True)

    def change_own_password(self, user: WifiUser, current_password: str, new_password: str,
                            throttle: PasswordGuessThrottle, keep_token_hash: str) -> None:
        """A signed-in Wi-Fi user changes their own password. Optional, never forced.
        The current password is asked again, so a borrowed signed-in browser isn't enough."""
        if (wait := throttle.seconds_locked(user.username)) > 0:
            raise TooManyAttempts(f"Too many wrong passwords. Try again in {wait // 60 + 1} minute(s).")
        if user.is_expired():
            raise InvalidInput("Your account has expired, so the password can't be changed. Ask an admin.")
        try:
            given = nt_hash(current_password)
        except InvalidInput:
            given = ""  # can't be a valid current password; still counts as a wrong guess
        if not given or not hmac.compare_digest(given, user.nt_hash):
            throttle.failed(user.username)
            # 400, not 401: the session is still valid, only this password is wrong.
            raise InvalidInput("Your current password is wrong.")
        throttle.succeeded(user.username)

        check_wifi_password(new_password)
        if new_password == current_password:
            raise InvalidInput("The new password must be different from the current one.")
        user.nt_hash = nt_hash(new_password)
        user.updated_at = now()
        # Other browsers signed in with the old password are signed out; this one stays.
        WifiSessionRepository(self.db).delete_for_user(user.id, keep_token_hash=keep_token_hash)
        self.activity.add(user.username, "wifi.self_password", user.username)
        self._commit("Could not save.", radius_changed=True)

    def update_own_details(self, user: WifiUser, first_name: str | None, last_name: str | None,
                           email: str | None) -> WifiUser:
        """A Wi-Fi user edits their own name and email. Their ID, status and expiry stay admin-only."""
        return self.update(user.username, user.username, first_name=first_name, last_name=last_name, email=email)

    def delete(self, actor: str, username: str) -> None:
        self.users.delete(self.get(username))
        self.activity.add(actor, "wifi.delete", username)
        self._commit("Could not delete.", radius_changed=True)

    def _commit(self, conflict_message: str, radius_changed: bool) -> None:
        try:
            self.activity.prune()
            self.db.commit()
        except IntegrityError as e:
            self.db.rollback()
            raise Conflict(conflict_message) from e
        if radius_changed:
            self.exporter.export(self.db)
