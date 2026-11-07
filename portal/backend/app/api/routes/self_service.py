"""For Wi-Fi users, not admins: change your own Wi-Fi password. No sign-in; the current password proves who you are."""

from fastapi import APIRouter, Request

from app.api.deps import WifiServiceDep
from app.api.schemas import SelfServicePasswordIn

router = APIRouter(prefix="/api/self-service", tags=["self-service"])


@router.post("/password", status_code=204)
def change_my_wifi_password(body: SelfServicePasswordIn, request: Request, service: WifiServiceDep) -> None:
    service.change_own_password(body.username, body.current_password, body.new_password,
                                throttle=request.app.state.self_service_throttle)
