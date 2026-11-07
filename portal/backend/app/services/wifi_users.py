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

    def create(self, actor: str, username: str, password: str, full_name: str = "", note: str = "") -> WifiUser:
        check_username(username)
        user = WifiUser(
            username=username,
            full_name=clean_text(full_name, "Full name", FULL_NAME_MAX),
            note=clean_text(note, "Note", NOTE_MAX),
            nt_hash=nt_hash(password),
            enabled=True,
        )
        if self.users.get(username) is not None:
            raise Conflict(f"'{username}' already exists.")
        self.users.add(user)
        self.activity.add(actor, "wifi.create", username)
        self._commit(f"'{username}' already exists.", radius_changed=True)
        return user

    def update(self, actor: str, username: str, *, full_name: str | None = None,
               note: str | None = None, enabled: bool | None = None) -> WifiUser:
        user = self.get(username)
        if full_name is not None:
            user.full_name = clean_text(full_name, "Full name", FULL_NAME_MAX)
        if note is not None:
            user.note = clean_text(note, "Note", NOTE_MAX)
        toggled = enabled is not None and enabled != user.enabled
        if toggled:
            user.enabled = enabled
        user.updated_at = now()
        action = ("wifi.enable" if enabled else "wifi.disable") if toggled else "wifi.update"
        self.activity.add(actor, action, username)
        self._commit("Could not save.", radius_changed=toggled)
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
        stored = user.nt_hash if user and user.enabled else _DUMMY_NT_HASH
        if not given or not hmac.compare_digest(given, stored) or user is None or not user.enabled:
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
