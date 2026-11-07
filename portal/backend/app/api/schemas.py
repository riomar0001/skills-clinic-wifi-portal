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
    admin: str | None


class LoginIn(_In):
    username: str = Field(max_length=64)
    password: str = Field(max_length=200)


class SetupIn(_In):
    setup_code: str = Field(max_length=64)
    username: str = Field(max_length=64)
    password: str = Field(max_length=200)


# ----- Wi-Fi users -----

class WifiUserOut(_Out):
    username: str
    full_name: str
    note: str
    enabled: bool
    expires_at: int | None
    created_at: int
    updated_at: int

    @computed_field
    @property
    def expired(self) -> bool:
        return self.expires_at is not None and self.expires_at <= int(time.time())


# Unix seconds; strict so "123" or 1.5 aren't silently accepted.
Expiry = Annotated[int, Field(strict=True, ge=0, le=2**40)]


class WifiUserCreateIn(_In):
    username: str = Field(max_length=64)
    password: str = Field(max_length=200)
    full_name: str = Field(default="", max_length=200)
    note: str = Field(default="", max_length=600)
    expires_at: Expiry | None = None


class WifiUserUpdateIn(_In):
    full_name: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=600)
    enabled: bool | None = None
    expires_at: Expiry | None = None  # send null to remove the expiry; leave out to keep it


class PasswordIn(_In):
    password: str = Field(max_length=200)


class SelfServicePasswordIn(_In):
    username: str = Field(max_length=64)
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)


StatusFilter = Literal["all", "active", "disabled", "expired"]


# ----- admins -----

class AdminOut(_Out):
    username: str
    created_at: int


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


class DashboardOut(BaseModel):
    wifi_total: int
    wifi_active: int
    wifi_disabled: int
    wifi_expired: int
    admins: int
    radius: RadiusStatusOut
    certificate: CertificateOut | None
    recent_activity: list[ActivityOut]
