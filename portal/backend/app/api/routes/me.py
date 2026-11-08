"""A signed-in Wi-Fi user's own account: details, connection history and password."""

from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.api.deps import CurrentWifiUserDep, DbDep, SettingsDep, WifiServiceDep
from app.api.schemas import ConnectionOut, MeOut, MePasswordIn, MeUpdateIn
from app.services.connection_log import ConnectionLogService

router = APIRouter(prefix="/api/me", tags=["me"])


def _me_out(current, db, settings) -> MeOut:
    out = MeOut.model_validate(current.user)
    out.last_connected_at = ConnectionLogService(db, settings).last_success(current.user.username)
    return out


@router.get("", response_model=MeOut)
def get_me(current: CurrentWifiUserDep, db: DbDep, settings: SettingsDep) -> MeOut:
    ConnectionLogService(db, settings).import_new()
    return _me_out(current, db, settings)


@router.patch("", response_model=MeOut)
def update_me(body: MeUpdateIn, current: CurrentWifiUserDep, service: WifiServiceDep, db: DbDep,
              settings: SettingsDep) -> MeOut:
    service.update_own_details(current.user, body.first_name, body.last_name, body.email)
    return _me_out(current, db, settings)


@router.put("/password", status_code=204)
def change_my_password(body: MePasswordIn, request: Request, current: CurrentWifiUserDep,
                       service: WifiServiceDep) -> None:
    service.change_own_password(current.user, body.current_password, body.new_password,
                                throttle=request.app.state.throttle, keep_token_hash=current.token_hash)


@router.get("/connections", response_model=list[ConnectionOut])
def my_connections(current: CurrentWifiUserDep, db: DbDep, settings: SettingsDep,
                   limit: Annotated[int, Query(ge=1, le=500)] = 100):
    return ConnectionLogService(db, settings).for_user(current.user.username, limit)
