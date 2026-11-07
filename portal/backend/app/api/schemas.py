"""Request and response bodies. Length caps here only bound input size; services give the friendly errors."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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
    created_at: int
    updated_at: int


class WifiUserCreateIn(_In):
    username: str = Field(max_length=64)
    password: str = Field(max_length=200)
    full_name: str = Field(default="", max_length=200)
    note: str = Field(default="", max_length=600)


class WifiUserUpdateIn(_In):
    full_name: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=600)
    enabled: bool | None = None


class PasswordIn(_In):
    password: str = Field(max_length=200)


StatusFilter = Literal["all", "enabled", "disabled"]


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
    wifi_enabled: int
    wifi_disabled: int
    admins: int
    radius: RadiusStatusOut
    certificate: CertificateOut | None
    recent_activity: list[ActivityOut]
