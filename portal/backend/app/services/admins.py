from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import Conflict, InvalidInput, NotFound
from app.core.passwords import check_username, hash_admin_password, verify_admin_password
from app.db.models import Admin
from app.repositories.activity import ActivityRepository
from app.repositories.admins import AdminRepository, SessionRepository


class AdminService:
    def __init__(self, db: Session):
        self.db = db
        self.admins = AdminRepository(db)
        self.sessions = SessionRepository(db)
        self.activity = ActivityRepository(db)

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
        admin.password_hash = hash_admin_password(new_password)
        # Sign out the account's other browsers; this one stays signed in.
        self.sessions.delete_for_admin(admin.id, keep_token_hash=keep_token_hash)
        self.activity.add(admin.username, "admin.password", admin.username)
        self._commit("Could not save.")

    def reset_password(self, username: str, new_password: str) -> None:
        """For the command-line recovery tool; signs the admin out everywhere."""
        admin = self.admins.get(username)
        if admin is None:
            raise NotFound(f"No admin named '{username}'.")
        admin.password_hash = hash_admin_password(new_password)
        self.sessions.delete_for_admin(admin.id)
        self.activity.add("console", "admin.password", username)
        self._commit("Could not save.")

    def _commit(self, conflict_message: str) -> None:
        try:
            self.activity.prune()
            self.db.commit()
        except IntegrityError as e:
            self.db.rollback()
            raise Conflict(conflict_message) from e
