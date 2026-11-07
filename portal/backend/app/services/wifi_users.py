from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import Conflict, NotFound
from app.core.passwords import FULL_NAME_MAX, NOTE_MAX, check_username, clean_text, nt_hash
from app.db.models import WifiUser, now
from app.repositories.activity import ActivityRepository
from app.repositories.wifi_users import StatusFilter, WifiUserRepository
from app.services.radius_export import RadiusUsersExporter


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
