from typing import Annotated

from fastapi import APIRouter, Path, Query, Request

from app.api.deps import AdminServiceDep, CurrentAdminDep, DbDep, SettingsDep, WifiServiceDep
from app.api.schemas import (AdminOut, ConnectionOut, DeviceOut, ImportRowOut, PasswordIn, StatusFilter, WifiUserCreateIn,
                             WifiUserImportIn, WifiUserImportOut, WifiUserOut, WifiUserUpdateIn)
from app.core.passwords import USERNAME_PATTERN
from app.services import csv_import
from app.services.connection_log import ConnectionLogService
from app.services.wifi_users import UNSET

router = APIRouter(prefix="/api/wifi-users", tags=["wifi-users"])
Username = Annotated[str, Path(pattern=USERNAME_PATTERN)]


@router.get("", response_model=list[WifiUserOut])
def list_users(_: CurrentAdminDep, service: WifiServiceDep,
               search: Annotated[str, Query(max_length=64)] = "",
               status: StatusFilter = "all"):
    return service.list(search, status)


@router.post("", response_model=WifiUserOut, status_code=201)
def create_user(body: WifiUserCreateIn, current: CurrentAdminDep, service: WifiServiceDep):
    return service.create(current.admin.username, body.username, body.password, first_name=body.first_name,
                          last_name=body.last_name, email=body.email, note=body.note, expires_at=body.expires_at,
                          device_limit=body.device_limit)


@router.post("/import", response_model=WifiUserImportOut)
def import_users(body: WifiUserImportIn, current: CurrentAdminDep, db: DbDep, request: Request):
    rows, added = csv_import.import_users(db, request.app.state.exporter, current.admin.username, body.csv,
                                          expires_at=body.expires_at, device_limit=body.device_limit,
                                          commit=not body.dry_run)
    return WifiUserImportOut(
        rows=[ImportRowOut(line=r.line, username=r.username, first_name=r.first_name, last_name=r.last_name,
                           email=r.email, errors=r.errors, password=r.password if added else None) for r in rows],
        error_count=sum(1 for r in rows if r.errors),
        added=added,
    )


@router.post("/{username}/promote", response_model=AdminOut, status_code=201)
def promote(username: Username, current: CurrentAdminDep, service: AdminServiceDep):
    """Makes this Wi-Fi user an admin who signs in with their ID and Wi-Fi password."""
    return service.promote(current.admin.username, username)


@router.get("/{username}", response_model=WifiUserOut)
def get_user(username: Username, _: CurrentAdminDep, service: WifiServiceDep):
    return service.get(username)


@router.get("/{username}/connections", response_model=list[ConnectionOut])
def user_connections(username: Username, _: CurrentAdminDep, service: WifiServiceDep, db: DbDep,
                     settings: SettingsDep, limit: Annotated[int, Query(ge=1, le=500)] = 50):
    service.get(username)  # 404 for unknown users
    return ConnectionLogService(db, settings).for_user(username, limit)


@router.get("/{username}/devices", response_model=list[DeviceOut])
def user_devices(username: Username, _: CurrentAdminDep, service: WifiServiceDep, db: DbDep, settings: SettingsDep):
    ConnectionLogService(db, settings).import_new()
    return service.get(username).devices


@router.delete("/{username}/devices/{device_id}", status_code=204)
def remove_device(username: Username, device_id: Annotated[int, Path(ge=1)], current: CurrentAdminDep,
                  service: WifiServiceDep):
    service.remove_device(current.admin.username, username, device_id)


@router.patch("/{username}", response_model=WifiUserOut)
def update_user(username: Username, body: WifiUserUpdateIn, current: CurrentAdminDep, service: WifiServiceDep):
    sent = body.model_fields_set
    return service.update(current.admin.username, username, new_username=body.username, first_name=body.first_name,
                          last_name=body.last_name, email=body.email, note=body.note, enabled=body.enabled,
                          expires_at=body.expires_at if "expires_at" in sent else UNSET,
                          device_limit=body.device_limit if "device_limit" in sent else UNSET)


@router.put("/{username}/password", status_code=204)
def set_password(username: Username, body: PasswordIn, current: CurrentAdminDep, service: WifiServiceDep):
    service.set_password(current.admin.username, username, body.password)


@router.delete("/{username}", status_code=204)
def delete_user(username: Username, current: CurrentAdminDep, service: WifiServiceDep):
    service.delete(current.admin.username, username)
