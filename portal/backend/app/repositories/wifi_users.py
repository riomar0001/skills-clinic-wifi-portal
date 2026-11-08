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
            # Only the part of the email up to "@": every address shares the domain, so matching
            # it would turn searches like "ana" (as in umindanao) into "everyone".
            email_local = func.substr(WifiUser.email, 1, func.instr(WifiUser.email, "@"))
            stmt = stmt.where(or_(*(col.ilike(like, escape="\\") for col in (
                WifiUser.username, WifiUser.first_name, WifiUser.last_name, email_local,
                (WifiUser.first_name + " " + WifiUser.last_name)))))
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

    def get_by_email(self, email: str) -> WifiUser | None:
        return self.db.scalar(select(WifiUser).where(WifiUser.email == email))

    def add(self, user: WifiUser) -> None:
        self.db.add(user)

    def delete(self, user: WifiUser) -> None:
        self.db.delete(user)

    def enabled_users(self) -> list[WifiUser]:
        """Every enabled user. Expired ones stay listed: FreeRADIUS refuses them itself,
        so access ends on time even if nothing re-exports the file."""
        return list(self.db.scalars(select(WifiUser).where(WifiUser.enabled.is_(True)).order_by(WifiUser.username)))

    def counts(self) -> dict[str, int]:
        at = now()
        count = lambda *where: self.db.scalar(select(func.count()).select_from(WifiUser).where(*where)) or 0  # noqa: E731
        return {
            "total": count(),
            "active": count(WifiUser.enabled.is_(True), _not_expired(at)),
            "disabled": count(WifiUser.enabled.is_(False)),
            "expired": count(WifiUser.expires_at.is_not(None), WifiUser.expires_at <= at),
        }
