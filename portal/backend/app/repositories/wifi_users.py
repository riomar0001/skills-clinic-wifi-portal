from __future__ import annotations

from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import WifiUser

StatusFilter = Literal["all", "enabled", "disabled"]


class WifiUserRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self, search: str = "", status: StatusFilter = "all") -> list[WifiUser]:
        stmt = select(WifiUser).order_by(WifiUser.username)
        if search:
            like = f"%{search.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')}%"
            stmt = stmt.where(or_(WifiUser.username.ilike(like, escape="\\"),
                                  WifiUser.full_name.ilike(like, escape="\\")))
        if status == "enabled":
            stmt = stmt.where(WifiUser.enabled.is_(True))
        elif status == "disabled":
            stmt = stmt.where(WifiUser.enabled.is_(False))
        return list(self.db.scalars(stmt))

    def get(self, username: str) -> WifiUser | None:
        return self.db.scalar(select(WifiUser).where(WifiUser.username == username))

    def add(self, user: WifiUser) -> None:
        self.db.add(user)

    def delete(self, user: WifiUser) -> None:
        self.db.delete(user)

    def enabled_credentials(self) -> list[tuple[str, str]]:
        stmt = (select(WifiUser.username, WifiUser.nt_hash)
                .where(WifiUser.enabled.is_(True)).order_by(WifiUser.username))
        return [(name, h) for name, h in self.db.execute(stmt)]

    def counts(self) -> tuple[int, int]:
        """(total, enabled)"""
        total = self.db.scalar(select(func.count()).select_from(WifiUser)) or 0
        enabled = self.db.scalar(select(func.count()).select_from(WifiUser)
                                 .where(WifiUser.enabled.is_(True))) or 0
        return total, enabled
