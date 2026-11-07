"""Database tables. Times are Unix seconds (UTC) to keep SQLite free of timezone surprises."""

import time

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now() -> int:
    return int(time.time())


class Base(DeclarativeBase):
    pass


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[int] = mapped_column(Integer, default=now)


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("admins.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[int] = mapped_column(Integer, default=now)
    last_seen_at: Mapped[int] = mapped_column(Integer, default=now, index=True)


class WifiUser(Base):
    __tablename__ = "wifi_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True)
    full_name: Mapped[str] = mapped_column(String(80), default="")
    note: Mapped[str] = mapped_column(String(300), default="")
    nt_hash: Mapped[str] = mapped_column(String(32))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # After this moment FreeRADIUS refuses the login (Expiration attribute); None = never expires.
    expires_at: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    created_at: Mapped[int] = mapped_column(Integer, default=now)
    updated_at: Mapped[int] = mapped_column(Integer, default=now)

    def is_expired(self, at: int | None = None) -> bool:
        return self.expires_at is not None and self.expires_at <= (now() if at is None else at)


class ActivityEntry(Base):
    __tablename__ = "activity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    at: Mapped[int] = mapped_column(Integer, default=now, index=True)
    actor: Mapped[str] = mapped_column(String(32))
    action: Mapped[str] = mapped_column(String(32))
    target: Mapped[str] = mapped_column(String(64))


class Meta(Base):
    """One-off flags, e.g. whether the old user list has been imported."""

    __tablename__ = "meta"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(200))
