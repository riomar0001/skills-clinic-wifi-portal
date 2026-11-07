from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.models import Admin, AdminSession


class AdminRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[Admin]:
        return list(self.db.scalars(select(Admin).order_by(Admin.username)))

    def get(self, username: str) -> Admin | None:
        return self.db.scalar(select(Admin).where(Admin.username == username))

    def get_by_id(self, admin_id: int) -> Admin | None:
        return self.db.get(Admin, admin_id)

    def count(self) -> int:
        return self.db.scalar(select(func.count()).select_from(Admin)) or 0

    def add(self, admin: Admin) -> None:
        self.db.add(admin)

    def delete(self, admin: Admin) -> None:
        self.db.delete(admin)


class SessionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, token_hash: str) -> AdminSession | None:
        return self.db.get(AdminSession, token_hash)

    def add(self, session: AdminSession) -> None:
        self.db.add(session)

    def delete(self, token_hash: str) -> None:
        self.db.execute(delete(AdminSession).where(AdminSession.token_hash == token_hash))

    def delete_for_admin(self, admin_id: int, keep_token_hash: str | None = None) -> None:
        stmt = delete(AdminSession).where(AdminSession.admin_id == admin_id)
        if keep_token_hash:
            stmt = stmt.where(AdminSession.token_hash != keep_token_hash)
        self.db.execute(stmt)

    def delete_idle(self, older_than: int) -> None:
        self.db.execute(delete(AdminSession).where(AdminSession.last_seen_at < older_than))
