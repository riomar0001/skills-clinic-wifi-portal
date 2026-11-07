from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.api.deps import CurrentAdminDep, WifiServiceDep
from app.api.schemas import PasswordIn, StatusFilter, WifiUserCreateIn, WifiUserOut, WifiUserUpdateIn
from app.core.passwords import USERNAME_PATTERN

router = APIRouter(prefix="/api/wifi-users", tags=["wifi-users"])
Username = Annotated[str, Path(pattern=USERNAME_PATTERN)]


@router.get("", response_model=list[WifiUserOut])
def list_users(_: CurrentAdminDep, service: WifiServiceDep,
               search: Annotated[str, Query(max_length=64)] = "",
               status: StatusFilter = "all"):
    return service.list(search, status)


@router.post("", response_model=WifiUserOut, status_code=201)
def create_user(body: WifiUserCreateIn, current: CurrentAdminDep, service: WifiServiceDep):
    return service.create(current.admin.username, body.username.strip(), body.password,
                          body.full_name, body.note)


@router.get("/{username}", response_model=WifiUserOut)
def get_user(username: Username, _: CurrentAdminDep, service: WifiServiceDep):
    return service.get(username)


@router.patch("/{username}", response_model=WifiUserOut)
def update_user(username: Username, body: WifiUserUpdateIn, current: CurrentAdminDep, service: WifiServiceDep):
    return service.update(current.admin.username, username,
                          full_name=body.full_name, note=body.note, enabled=body.enabled)


@router.put("/{username}/password", status_code=204)
def set_password(username: Username, body: PasswordIn, current: CurrentAdminDep, service: WifiServiceDep):
    service.set_password(current.admin.username, username, body.password)


@router.delete("/{username}", status_code=204)
def delete_user(username: Username, current: CurrentAdminDep, service: WifiServiceDep):
    service.delete(current.admin.username, username)
