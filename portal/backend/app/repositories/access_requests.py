from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.models import AccessRequest


class AccessRequestRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[AccessRequest]:
        return list(self.db.scalars(select(AccessRequest).order_by(AccessRequest.created_at, AccessRequest.id)))

    def get(self, request_id: int) -> AccessRequest | None:
        return self.db.get(AccessRequest, request_id)

    def get_by_username(self, username: str) -> AccessRequest | None:
        return self.db.scalar(select(AccessRequest).where(AccessRequest.username == username))

    def get_by_email(self, email: str) -> AccessRequest | None:
        return self.db.scalar(select(AccessRequest).where(AccessRequest.email == email))

    def count(self) -> int:
        return self.db.scalar(select(func.count()).select_from(AccessRequest)) or 0

    def add(self, request: AccessRequest) -> None:
        self.db.add(request)

    def delete(self, request: AccessRequest) -> None:
        self.db.delete(request)

    def delete_older_than(self, cutoff: int) -> None:
        self.db.execute(delete(AccessRequest).where(AccessRequest.created_at < cutoff))
