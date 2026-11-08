"""Dashboard, activity log, certificate and database backup."""

import sqlite3
import tempfile
import time
from pathlib import Path as FsPath
from typing import Annotated

from fastapi import APIRouter, Path, Query, Request
from fastapi.responses import FileResponse, Response

from app.api.deps import CurrentAdminDep, DbDep, SettingsDep
from app.api.schemas import (ActivityOut, CertificateOut, ConfirmPasswordIn, DashboardOut, RadiusStatusOut,
                             RouterSecretOut)
from app.core.errors import NotFound
from app.repositories.access_requests import AccessRequestRepository
from app.repositories.activity import ActivityRepository
from app.repositories.admins import AdminRepository
from app.repositories.wifi_users import WifiUserRepository
from app.services.admin_password import confirm_admin_password
from app.services.certificate import CertificateService
from app.services.router_secret import RouterSecretService

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(request: Request, _: CurrentAdminDep, db: DbDep, settings: SettingsDep) -> DashboardOut:
    counts = WifiUserRepository(db).counts()
    health = request.app.state.health.check()
    try:
        cert = CertificateOut(**vars(CertificateService(settings).info()))
    except NotFound:
        cert = None
    return DashboardOut(
        wifi_total=counts["total"], wifi_active=counts["active"],
        wifi_disabled=counts["disabled"], wifi_expired=counts["expired"],
        access_requests=AccessRequestRepository(db).count(),
        admins=AdminRepository(db).count(),
        radius=RadiusStatusOut(ok=health.ok, detail=health.detail),
        certificate=cert,
        recent_activity=[ActivityOut.model_validate(a) for a in ActivityRepository(db).recent(8)],
    )


@router.get("/activity", response_model=list[ActivityOut])
def activity(_: CurrentAdminDep, db: DbDep, limit: Annotated[int, Query(ge=1, le=500)] = 200):
    return ActivityRepository(db).recent(limit)


@router.get("/certificate", response_model=CertificateOut)
def certificate(_: CurrentAdminDep, settings: SettingsDep) -> CertificateOut:
    return CertificateOut(**vars(CertificateService(settings).info()))


@router.get("/certificate/{filename}")
def certificate_file(filename: Annotated[str, Path(pattern=r"^ca\.(der|pem)$")],
                     _: CurrentAdminDep, settings: SettingsDep) -> FileResponse:
    path, media_type = CertificateService(settings).download(filename)
    return FileResponse(path, media_type=media_type, filename=filename)


@router.post("/router-secret", response_model=RouterSecretOut)
def router_secret(body: ConfirmPasswordIn, request: Request, current: CurrentAdminDep, db: DbDep,
                  settings: SettingsDep) -> RouterSecretOut:
    """The secret the router needs. Asks for the admin's password again, even when signed in."""
    revealed = RouterSecretService(db, settings, request.app.state.throttle).reveal(current.admin, body.password)
    return RouterSecretOut(secret=revealed.secret, clients_conf=revealed.clients_conf)


@router.post("/backup")
def backup(body: ConfirmPasswordIn, request: Request, current: CurrentAdminDep, db: DbDep,
           settings: SettingsDep) -> Response:
    """A consistent copy of the database (admins, Wi-Fi users, activity), safe to take while running.
    It holds every password hash, so the admin types their password again, like for the router secret."""
    confirm_admin_password(db, current.admin, body.password, request.app.state.throttle)
    ActivityRepository(db).add(current.admin.username, "admin.backup", "database")
    db.commit()
    with tempfile.TemporaryDirectory(dir=settings.db_path.parent) as tmp:
        target = FsPath(tmp) / "backup.db"
        src = sqlite3.connect(settings.db_path, timeout=10)
        try:
            dst = sqlite3.connect(target)
            try:
                src.backup(dst)
            finally:
                dst.close()
        finally:
            src.close()
        data = target.read_bytes()
    name = time.strftime("wifi-portal-%Y%m%d-%H%M%S.db")
    return Response(data, media_type="application/vnd.sqlite3",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})
