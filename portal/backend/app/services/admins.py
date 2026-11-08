from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import Conflict, InvalidInput, NotFound
from app.core.passwords import WIFI_LINKED_HASH, check_username, check_wifi_password, hash_admin_password, nt_hash
from app.db.models import Admin, now
from app.repositories.activity import ActivityRepository
from app.repositories.admins import AdminRepository, SessionRepository, WifiSessionRepository
from app.repositories.wifi_users import WifiUserRepository
from app.services.admin_password import admin_password_matches
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

    def promote(self, actor: str, username: str) -> Admin:
        """Makes a Wi-Fi user an admin who signs in with their ID and Wi-Fi password. Their Wi-Fi account
        doesn't change; disabling, expiring or deleting it also ends their admin sign-in."""
        wifi = self.wifi_users.get(username)
        if wifi is None:
            raise NotFound(f"No Wi-Fi user with ID '{username}'.")
        if self.admins.get(wifi.username) is not None:
            raise Conflict(f"'{wifi.username}' is already an admin.")
        if not wifi.enabled or wifi.is_expired():
            raise InvalidInput("Their Wi-Fi access is off or expired. Turn it back on first: "
                               "they'd sign in to the admin portal with it.")
        admin = Admin(username=wifi.username, password_hash=WIFI_LINKED_HASH)
        self.admins.add(admin)
        self.activity.add(actor, "admin.promote", wifi.username)
        self._commit(f"'{wifi.username}' is already an admin.")
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
        if not admin_password_matches(self.db, admin, current_password):
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
        wifi = self.wifi_users.get(admin.username)
        # A promoted admin's password lives in their Wi-Fi account, so it stays there. If that account is gone,
        # the admin gets a password of their own (how reset-admin recovers such an admin).
        linked = admin.password_hash == WIFI_LINKED_HASH and wifi is not None
        password_hash = WIFI_LINKED_HASH if linked else hash_admin_password(new_password)  # raises if too short
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
