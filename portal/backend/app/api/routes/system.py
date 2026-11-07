"""Dashboard, activity log, certificate and database backup."""

import sqlite3
import tempfile
import time
from pathlib import Path as FsPath
from typing import Annotated

from fastapi import APIRouter, Path, Query, Request
from fastapi.responses import FileResponse, Response

from app.api.deps import CurrentAdminDep, DbDep, SettingsDep
from app.api.schemas import ActivityOut, CertificateOut, DashboardOut, RadiusStatusOut
from app.core.errors import NotFound
from app.repositories.activity import ActivityRepository
from app.repositories.admins import AdminRepository
from app.repositories.wifi_users import WifiUserRepository
from app.services.certificate import CertificateService

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(request: Request, _: CurrentAdminDep, db: DbDep, settings: SettingsDep) -> DashboardOut:
    total, enabled = WifiUserRepository(db).counts()
    health = request.app.state.health.check()
    try:
        cert = CertificateOut(**vars(CertificateService(settings).info()))
    except NotFound:
        cert = None
    return DashboardOut(
        wifi_total=total, wifi_enabled=enabled, wifi_disabled=total - enabled,
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


@router.get("/backup")
def backup(_: CurrentAdminDep, settings: SettingsDep) -> Response:
    """A consistent copy of the database (admins, Wi-Fi users, activity), safe to take while running."""
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
