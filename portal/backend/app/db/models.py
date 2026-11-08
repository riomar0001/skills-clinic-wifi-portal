"""Database tables. Times are Unix seconds (UTC) to keep SQLite free of timezone surprises."""

import time

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.core.passwords import WIFI_LINKED_HASH


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

    @property
    def uses_wifi_password(self) -> bool:
        """Promoted from a Wi-Fi user: signs in with the Wi-Fi password of the account with the same ID."""
        return self.password_hash == WIFI_LINKED_HASH


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("admins.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[int] = mapped_column(Integer, default=now)
    last_seen_at: Mapped[int] = mapped_column(Integer, default=now, index=True)


class WifiUser(Base):
    __tablename__ = "wifi_users"
    __table_args__ = (UniqueConstraint("email", name="uq_wifi_users_email"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True)
    # username is the person's Student ID or Faculty ID; it's what they type to join the Wi-Fi.
    first_name: Mapped[str] = mapped_column(String(60), default="", server_default="")
    last_name: Mapped[str] = mapped_column(String(60), default="", server_default="")
    # UMindanao email; None only for accounts created before emails were collected.
    email: Mapped[str | None] = mapped_column(String(254), nullable=True, default=None)
    note: Mapped[str] = mapped_column(String(300), default="")
    nt_hash: Mapped[str] = mapped_column(String(32))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # After this moment FreeRADIUS refuses the login (Expiration attribute); None = never expires.
    expires_at: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    # How many devices may use this account; None = no limit. Devices register on their first login.
    device_limit: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    devices: Mapped[list["WifiDevice"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True, lazy="selectin",
        order_by="WifiDevice.first_seen_at")
    created_at: Mapped[int] = mapped_column(Integer, default=now)
    updated_at: Mapped[int] = mapped_column(Integer, default=now)

    def is_expired(self, at: int | None = None) -> bool:
        return self.expires_at is not None and self.expires_at <= (now() if at is None else at)

    @property
    def device_count(self) -> int:
        return len(self.devices)

    def allowed_devices(self) -> list[str] | None:
        """MACs the login server should accept, or None for "any device".
        Only restricted once the limit is reached; until then new devices may join and register."""
        if self.device_limit is None or len(self.devices) < self.device_limit:
            return None
        return [d.mac for d in self.devices]


class WifiDevice(Base):
    """A phone or laptop that has logged in with a Wi-Fi account (registered on its first accepted login)."""

    __tablename__ = "wifi_devices"
    __table_args__ = (UniqueConstraint("wifi_user_id", "mac", name="uq_wifi_devices_user_mac"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wifi_user_id: Mapped[int] = mapped_column(ForeignKey("wifi_users.id", ondelete="CASCADE"), index=True)
    mac: Mapped[str] = mapped_column(String(17))  # AA-BB-CC-DD-EE-FF
    first_seen_at: Mapped[int] = mapped_column(Integer, default=now)
    last_seen_at: Mapped[int] = mapped_column(Integer, default=now)
    user: Mapped[WifiUser] = relationship(back_populates="devices")


class WifiUserSession(Base):
    """A Wi-Fi user signed in to their own portal (separate from admin sessions)."""

    __tablename__ = "wifi_user_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    wifi_user_id: Mapped[int] = mapped_column(ForeignKey("wifi_users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[int] = mapped_column(Integer, default=now)
    last_seen_at: Mapped[int] = mapped_column(Integer, default=now, index=True)


class AccessRequest(Base):
    """Someone asking for a Wi-Fi account from the sign-in page, waiting for an admin.
    Only the NT hash of the password they chose is kept (what the login server needs), never the password."""

    __tablename__ = "access_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True)  # Student ID / Faculty ID
    first_name: Mapped[str] = mapped_column(String(60))
    last_name: Mapped[str] = mapped_column(String(60))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    nt_hash: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[int] = mapped_column(Integer, default=now, index=True)


class ConnectionEvent(Base):
    """One Wi-Fi login attempt, imported from FreeRADIUS (wifi-events.conf)."""

    __tablename__ = "connection_events"
    __table_args__ = (Index("ix_connection_events_username_at", "username", "at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    at: Mapped[int] = mapped_column(Integer)
    username: Mapped[str] = mapped_column(String(32))
    accepted: Mapped[bool] = mapped_column(Boolean)
    device: Mapped[str] = mapped_column(String(32), default="")  # MAC address the phone or laptop reported


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
