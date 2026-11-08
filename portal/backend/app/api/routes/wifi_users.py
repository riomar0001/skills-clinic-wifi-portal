from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.api.deps import CurrentAdminDep, WifiServiceDep
from app.api.schemas import PasswordIn, StatusFilter, WifiUserCreateIn, WifiUserOut, WifiUserUpdateIn
from app.core.passwords import USERNAME_PATTERN
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
                          last_name=body.last_name, email=body.email, note=body.note, expires_at=body.expires_at)


@router.get("/{username}", response_model=WifiUserOut)
def get_user(username: Username, _: CurrentAdminDep, service: WifiServiceDep):
    return service.get(username)


@router.patch("/{username}", response_model=WifiUserOut)
def update_user(username: Username, body: WifiUserUpdateIn, current: CurrentAdminDep, service: WifiServiceDep):
    expiry = body.expires_at if "expires_at" in body.model_fields_set else UNSET
    return service.update(current.admin.username, username, first_name=body.first_name, last_name=body.last_name,
                          email=body.email, note=body.note, enabled=body.enabled, expires_at=expiry)


@router.put("/{username}/password", status_code=204)
def set_password(username: Username, body: PasswordIn, current: CurrentAdminDep, service: WifiServiceDep):
    service.set_password(current.admin.username, username, body.password)


@router.delete("/{username}", status_code=204)
def delete_user(username: Username, current: CurrentAdminDep, service: WifiServiceDep):
    service.delete(current.admin.username, username)
