from __future__ import annotations

from typing import Literal

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import WifiUser, now

# active = enabled and not expired; expired = past its expiry (enabled or not); disabled = switched off.
StatusFilter = Literal["all", "active", "disabled", "expired"]


def _not_expired(at: int):
    return or_(WifiUser.expires_at.is_(None), WifiUser.expires_at > at)


class WifiUserRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self, search: str = "", status: StatusFilter = "all") -> list[WifiUser]:
        stmt = select(WifiUser).order_by(WifiUser.username)
        if search:
            like = f"%{search.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')}%"
            stmt = stmt.where(or_(WifiUser.username.ilike(like, escape="\\"),
                                  WifiUser.full_name.ilike(like, escape="\\")))
        at = now()
        if status == "active":
            stmt = stmt.where(and_(WifiUser.enabled.is_(True), _not_expired(at)))
        elif status == "disabled":
            stmt = stmt.where(WifiUser.enabled.is_(False))
        elif status == "expired":
            stmt = stmt.where(and_(WifiUser.expires_at.is_not(None), WifiUser.expires_at <= at))
        return list(self.db.scalars(stmt))

    def get(self, username: str) -> WifiUser | None:
        return self.db.scalar(select(WifiUser).where(WifiUser.username == username))

    def add(self, user: WifiUser) -> None:
        self.db.add(user)

    def delete(self, user: WifiUser) -> None:
        self.db.delete(user)

    def enabled_credentials(self) -> list[tuple[str, str, int | None]]:
        """(username, NT hash, expires_at) for every enabled user. Expired ones stay listed:
        FreeRADIUS refuses them itself, so access ends on time even if nothing re-exports the file."""
        stmt = (select(WifiUser.username, WifiUser.nt_hash, WifiUser.expires_at)
                .where(WifiUser.enabled.is_(True)).order_by(WifiUser.username))
        return [(name, h, exp) for name, h, exp in self.db.execute(stmt)]

    def counts(self) -> dict[str, int]:
        at = now()
        count = lambda *where: self.db.scalar(select(func.count()).select_from(WifiUser).where(*where)) or 0  # noqa: E731
        return {
            "total": count(),
            "active": count(WifiUser.enabled.is_(True), _not_expired(at)),
            "disabled": count(WifiUser.enabled.is_(False)),
            "expired": count(WifiUser.expires_at.is_not(None), WifiUser.expires_at <= at),
        }
