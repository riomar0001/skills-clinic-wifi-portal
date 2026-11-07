"""FastAPI dependencies: database session, services and the signed-in admin."""

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import NotAuthenticated
from app.db.models import Admin
from app.services.admins import AdminService
from app.services.auth import AuthService
from app.services.wifi_users import WifiUserService

SESSION_COOKIE = "portal_session"


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request) -> Iterator[Session]:
    db = request.app.state.session_factory()
    try:
        yield db
    finally:
        db.close()  # rolls back anything not committed


SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Session, Depends(get_db)]


def get_auth_service(request: Request, db: DbDep, settings: SettingsDep) -> AuthService:
    return AuthService(db, settings, request.app.state.throttle)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


@dataclass(frozen=True)
class CurrentAdmin:
    admin: Admin
    token_hash: str


def get_current_admin(request: Request, auth: AuthServiceDep) -> CurrentAdmin:
    resolved = auth.resolve(request.cookies.get(SESSION_COOKIE))
    if resolved is None:
        raise NotAuthenticated("Please sign in.")
    return CurrentAdmin(*resolved)


CurrentAdminDep = Annotated[CurrentAdmin, Depends(get_current_admin)]


def get_wifi_service(request: Request, db: DbDep) -> WifiUserService:
    return WifiUserService(db, request.app.state.exporter)


def get_admin_service(db: DbDep) -> AdminService:
    return AdminService(db)


WifiServiceDep = Annotated[WifiUserService, Depends(get_wifi_service)]
AdminServiceDep = Annotated[AdminService, Depends(get_admin_service)]
