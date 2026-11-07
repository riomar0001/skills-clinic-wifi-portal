from typing import Annotated

from fastapi import APIRouter, Path

from app.api.deps import AdminServiceDep, CurrentAdminDep
from app.api.schemas import AdminCreateIn, AdminOut, ChangePasswordIn
from app.core.passwords import USERNAME_PATTERN

router = APIRouter(prefix="/api", tags=["admins"])


@router.get("/admins", response_model=list[AdminOut])
def list_admins(_: CurrentAdminDep, service: AdminServiceDep):
    return service.list()


@router.post("/admins", response_model=AdminOut, status_code=201)
def create_admin(body: AdminCreateIn, current: CurrentAdminDep, service: AdminServiceDep):
    return service.create(current.admin.username, body.username.strip(), body.password)


@router.delete("/admins/{username}", status_code=204)
def delete_admin(username: Annotated[str, Path(pattern=USERNAME_PATTERN)],
                 current: CurrentAdminDep, service: AdminServiceDep):
    service.delete(current.admin, username)


@router.put("/account/password", status_code=204)
def change_my_password(body: ChangePasswordIn, current: CurrentAdminDep, service: AdminServiceDep):
    service.change_own_password(current.admin, body.current_password, body.new_password,
                                keep_token_hash=current.token_hash)
