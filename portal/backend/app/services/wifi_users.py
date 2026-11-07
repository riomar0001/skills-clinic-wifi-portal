from __future__ import annotations

import hmac
from typing import Protocol

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import Conflict, InvalidInput, NotAuthenticated, NotFound, TooManyAttempts
from app.core.passwords import (FULL_NAME_MAX, NOTE_MAX, check_username, check_wifi_password, clean_text,
                                nt_hash)
from app.db.models import WifiUser, now
from app.repositories.activity import ActivityRepository
from app.repositories.wifi_users import StatusFilter, WifiUserRepository
from app.services.radius_export import RadiusUsersExporter


class PasswordGuessThrottle(Protocol):
    def seconds_locked(self, username: str) -> int: ...
    def failed(self, username: str) -> None: ...
    def succeeded(self, username: str) -> None: ...


# Compared against when the username doesn't exist, so both cases take the same path.
_DUMMY_NT_HASH = "0" * 32
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
            raise NotFound(f"No Wi-Fi user named '{username}'.")
        return user

    def create(self, actor: str, username: str, password: str, full_name: str = "", note: str = "",
               expires_at: int | None = None) -> WifiUser:
        check_username(username)
        user = WifiUser(
            username=username,
            full_name=clean_text(full_name, "Full name", FULL_NAME_MAX),
            note=clean_text(note, "Note", NOTE_MAX),
            nt_hash=nt_hash(password),
            enabled=True,
            expires_at=check_expiry(expires_at),
        )
        if self.users.get(username) is not None:
            raise Conflict(f"'{username}' already exists.")
        self.users.add(user)
        self.activity.add(actor, "wifi.create", username)
        self._commit(f"'{username}' already exists.", radius_changed=True)
        return user

    def update(self, actor: str, username: str, *, full_name: str | None = None, note: str | None = None,
               enabled: bool | None = None, expires_at: int | None | _Unset = UNSET) -> WifiUser:
        user = self.get(username)
        if full_name is not None:
            user.full_name = clean_text(full_name, "Full name", FULL_NAME_MAX)
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
        self._commit("Could not save.", radius_changed=toggled or expiry_changed)
        return user

    def set_password(self, actor: str, username: str, password: str) -> None:
        user = self.get(username)
        user.nt_hash = nt_hash(password)
        user.updated_at = now()
        self.activity.add(actor, "wifi.password", username)
        self._commit("Could not save.", radius_changed=True)

    def change_own_password(self, username: str, current_password: str, new_password: str,
                            throttle: PasswordGuessThrottle) -> None:
        """Self-service: a Wi-Fi user proves who they are with their current password."""
        username = (username or "").strip().lower()
        if (wait := throttle.seconds_locked(username)) > 0:
            raise TooManyAttempts(f"Too many wrong passwords. Try again in {wait // 60 + 1} minute(s).")
        user = self.users.get(username)
        try:
            given = nt_hash(current_password)
        except InvalidInput:
            given = ""  # can't be a valid current password; still counts as a wrong guess
        usable = user is not None and user.enabled and not user.is_expired()
        stored = user.nt_hash if usable else _DUMMY_NT_HASH
        if not given or not hmac.compare_digest(given, stored) or not usable:
            throttle.failed(username)
            raise NotAuthenticated("Wrong username or password.")
        throttle.succeeded(username)

        check_wifi_password(new_password)
        if new_password == current_password:
            raise InvalidInput("The new password must be different from the current one.")
        user.nt_hash = nt_hash(new_password)
        user.updated_at = now()
        self.activity.add(username, "wifi.self_password", username)
        self._commit("Could not save.", radius_changed=True)

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
