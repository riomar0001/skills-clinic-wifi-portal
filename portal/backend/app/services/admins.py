from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import Conflict, InvalidInput, NotFound
from app.core.passwords import (check_username, check_wifi_password, hash_admin_password, nt_hash,
                                verify_admin_password)
from app.db.models import Admin, now
from app.repositories.activity import ActivityRepository
from app.repositories.admins import AdminRepository, SessionRepository, WifiSessionRepository
from app.repositories.wifi_users import WifiUserRepository
from app.services.radius_export import RadiusUsersExporter

WIFI_TWIN_PASSWORD = ("You also have a Wi-Fi account with this name, which gets the same password, so it must also "
                      "be 8-64 plain keyboard characters (no accents or emoji).")


class AdminService:
    def __init__(self, db: Session, exporter: RadiusUsersExporter):
        self.db = db
        self.admins = AdminRepository(db)
        self.sessions = SessionRepository(db)
        self.activity = ActivityRepository(db)
        self.wifi_users = WifiUserRepository(db)
        self.exporter = exporter

    def list(self) -> list[Admin]:
        return self.admins.list()

    def create(self, actor: str, username: str, password: str) -> Admin:
        check_username(username)
        admin = Admin(username=username, password_hash=hash_admin_password(password))
        if self.admins.get(username) is not None:
            raise Conflict(f"Admin '{username}' already exists.")
        self.admins.add(admin)
        self.activity.add(actor, "admin.create", username)
        self._commit(f"Admin '{username}' already exists.")
        return admin

    def delete(self, actor: Admin, username: str) -> None:
        if username == actor.username:
            raise InvalidInput("You can't remove your own admin account.")
        admin = self.admins.get(username)
        if admin is None:
            raise NotFound(f"No admin named '{username}'.")
        if self.admins.count() <= 1:
            raise InvalidInput("There must be at least one admin.")
        self.sessions.delete_for_admin(admin.id)
        self.admins.delete(admin)
        self.activity.add(actor.username, "admin.delete", username)
        self._commit("Could not delete.")

    def change_own_password(self, admin: Admin, current_password: str, new_password: str,
                            keep_token_hash: str) -> None:
        if not verify_admin_password(current_password, admin.password_hash):
            raise InvalidInput("Your current password is wrong.")
        wifi_changed = self._set_password(admin, new_password, actor=admin.username)
        # Sign out the account's other browsers; this one stays signed in.
        self.sessions.delete_for_admin(admin.id, keep_token_hash=keep_token_hash)
        self.activity.add(admin.username, "admin.password", admin.username)
        self._commit("Could not save.", radius_changed=wifi_changed)

    def reset_password(self, username: str, new_password: str) -> None:
        """For the command-line recovery tool; signs the admin out everywhere."""
        admin = self.admins.get(username)
        if admin is None:
            raise NotFound(f"No admin named '{username}'.")
        wifi_changed = self._set_password(admin, new_password, actor="console")
        self.sessions.delete_for_admin(admin.id)
        self.activity.add("console", "admin.password", username)
        self._commit("Could not save.", radius_changed=wifi_changed)

    def _set_password(self, admin: Admin, new_password: str, actor: str) -> bool:
        """Sets the admin password and, when a Wi-Fi account has the same name, that Wi-Fi password too, so
        one password works for both. Everything is checked before anything changes. True if Wi-Fi changed."""
        password_hash = hash_admin_password(new_password)  # raises on a bad admin password
        wifi = self.wifi_users.get(admin.username)
        if wifi is not None:
            try:
                check_wifi_password(new_password)
            except InvalidInput as e:
                raise InvalidInput(WIFI_TWIN_PASSWORD) from e
            wifi.nt_hash = nt_hash(new_password)
            wifi.updated_at = now()
            # Like an admin's Wi-Fi password reset: My Wi-Fi browsers using the old password are signed out.
            WifiSessionRepository(self.db).delete_for_user(wifi.id)
            self.activity.add(actor, "wifi.password", wifi.username)
        admin.password_hash = password_hash
        return wifi is not None

    def _commit(self, conflict_message: str, radius_changed: bool = False) -> None:
        try:
            self.activity.prune()
            self.db.commit()
        except IntegrityError as e:
            self.db.rollback()
            raise Conflict(conflict_message) from e
        if radius_changed:
            self.exporter.export(self.db)
