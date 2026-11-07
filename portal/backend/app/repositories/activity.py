from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import ActivityEntry, Meta

ACTIVITY_KEEP = 2000


class ActivityRepository:
    def __init__(self, db: Session):
        self.db = db

    def add(self, actor: str, action: str, target: str) -> None:
        self.db.add(ActivityEntry(actor=actor, action=action, target=target))

    def recent(self, limit: int) -> list[ActivityEntry]:
        stmt = select(ActivityEntry).order_by(ActivityEntry.id.desc()).limit(limit)
        return list(self.db.scalars(stmt))

    def prune(self, keep: int = ACTIVITY_KEEP) -> None:
        cutoff = self.db.scalar(select(ActivityEntry.id).order_by(ActivityEntry.id.desc()).offset(keep).limit(1))
        if cutoff is not None:
            self.db.execute(delete(ActivityEntry).where(ActivityEntry.id <= cutoff))


class MetaRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, key: str) -> str | None:
        row = self.db.get(Meta, key)
        return row.value if row else None

    def set(self, key: str, value: str) -> None:
        self.db.merge(Meta(key=key, value=value))
