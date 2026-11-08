"""Request and response bodies. Length caps here only bound input size; services give the friendly errors."""

import time
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field


class _In(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ----- auth -----

class AuthStatus(BaseModel):
    needs_setup: bool
    role: Literal["admin", "wifi"] | None  # who is signed in: an admin or a Wi-Fi user
    username: str | None
    name: str | None


class LoginIn(_In):
    username: str = Field(max_length=64)
    password: str = Field(max_length=200)


class SetupIn(_In):
    setup_code: str = Field(max_length=64)
    username: str = Field(max_length=64)
    password: str = Field(max_length=200)


# ----- Wi-Fi users -----

class WifiUserOut(_Out):
    username: str  # Student ID / Faculty ID
    first_name: str
    last_name: str
    email: str | None
    note: str
    enabled: bool
    expires_at: int | None
    device_limit: int | None
    device_count: int
    created_at: int
    updated_at: int

    @computed_field
    @property
    def expired(self) -> bool:
        return self.expires_at is not None and self.expires_at <= int(time.time())


class DeviceOut(_Out):
    id: int
    mac: str
    first_seen_at: int
    last_seen_at: int


# Unix seconds; strict so "123" or 1.5 aren't silently accepted.
Expiry = Annotated[int, Field(strict=True, ge=0, le=2**40)]
DeviceLimit = Annotated[int, Field(strict=True, ge=1, le=20)]


class WifiUserCreateIn(_In):
    username: str = Field(max_length=64)  # Student ID / Faculty ID
    password: str = Field(max_length=200)
    first_name: str = Field(max_length=200)
    last_name: str = Field(max_length=200)
    email: str = Field(max_length=300)
    note: str = Field(default="", max_length=600)
    expires_at: Expiry | None = None
    device_limit: DeviceLimit | None = None  # None = no limit


class WifiUserUpdateIn(_In):
    username: str | None = Field(default=None, max_length=64)  # new Student/Faculty ID (admins only)
    first_name: str | None = Field(default=None, max_length=200)
    last_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=300)
    note: str | None = Field(default=None, max_length=600)
    enabled: bool | None = None
    expires_at: Expiry | None = None  # send null to remove the expiry; leave out to keep it
    device_limit: DeviceLimit | None = None  # send null for no limit; leave out to keep it


class PasswordIn(_In):
    password: str = Field(max_length=200)


class WifiUserImportIn(_In):
    csv: str = Field(max_length=1_000_000)
    expires_at: Expiry | None = None  # applied to every imported user
    device_limit: DeviceLimit | None = None
    dry_run: bool = True  # True = only check the file; False = add everyone if every row is valid


class ImportRowOut(_Out):
    line: int
    username: str
    first_name: str
    last_name: str
    email: str
    errors: list[str]
    password: str | None = None  # only after a real import, shown once


class WifiUserImportOut(BaseModel):
    rows: list[ImportRowOut]
    error_count: int  # rows with at least one problem
    added: int


# ----- access requests -----

class AccessRequestIn(_In):
    """From the public sign-in page; password is the Wi-Fi password the person wants."""
    username: str = Field(max_length=64)  # Student ID / Faculty ID
    password: str = Field(max_length=200)
    first_name: str = Field(max_length=200)
    last_name: str = Field(max_length=200)
    email: str = Field(max_length=300)


class AccessRequestSentOut(BaseModel):
    username: str


class AccessRequestOut(_Out):
    id: int
    username: str
    first_name: str
    last_name: str
    email: str
    created_at: int


class AccessRequestApproveIn(_In):
    expires_at: Expiry | None = None  # None = never expires
    device_limit: DeviceLimit | None = None  # None = no limit


# ----- Wi-Fi user's own portal -----

class MeOut(_Out):
    username: str
    first_name: str
    last_name: str
    email: str | None
    enabled: bool
    expires_at: int | None
    device_limit: int | None
    created_at: int
    last_connected_at: int | None = None
    devices: list[DeviceOut] = []

    @computed_field
    @property
    def expired(self) -> bool:
        return self.expires_at is not None and self.expires_at <= int(time.time())


class MeUpdateIn(_In):
    first_name: str | None = Field(default=None, max_length=200)
    last_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=300)


class MePasswordIn(_In):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)


class ConnectionOut(_Out):
    at: int
    accepted: bool
    device: str


StatusFilter = Literal["all", "active", "disabled", "expired"]


# ----- admins -----

class AdminOut(_Out):
    username: str
    created_at: int
    uses_wifi_password: bool  # promoted Wi-Fi user: signs in with their Wi-Fi password


class AdminCreateIn(_In):
    username: str = Field(max_length=64)
    password: str = Field(max_length=200)


class ChangePasswordIn(_In):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)


# ----- dashboard, activity, certificate -----

class ActivityOut(_Out):
    id: int
    at: int
    actor: str
    action: str
    target: str


class RadiusStatusOut(BaseModel):
    ok: bool
    detail: str


class CertificateOut(BaseModel):
    name: str
    issuer: str
    expires_at: int
    sha256: str
    trusted: bool  # Let's Encrypt: Android can use "system certificates" with this name as the domain


class ConfirmPasswordIn(_In):
    password: str = Field(max_length=200)


class RouterSecretOut(BaseModel):
    secret: str
    clients_conf: str


class DashboardOut(BaseModel):
    wifi_total: int
    wifi_active: int
    wifi_disabled: int
    wifi_expired: int
    access_requests: int  # waiting for an admin
    admins: int
    radius: RadiusStatusOut
    certificate: CertificateOut | None
    recent_activity: list[ActivityOut]
