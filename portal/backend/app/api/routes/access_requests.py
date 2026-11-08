from typing import Annotated

from fastapi import APIRouter, Path, Request

from app.api.deps import AccessRequestServiceDep, CurrentAdminDep
from app.api.schemas import (AccessRequestApproveIn, AccessRequestIn, AccessRequestOut, AccessRequestSentOut,
                             WifiUserOut)
from app.core.errors import TooManyAttempts

router = APIRouter(prefix="/api/access-requests", tags=["access-requests"])
RequestId = Annotated[int, Path(ge=1, le=2**31)]


@router.post("", response_model=AccessRequestSentOut, status_code=201)
def submit(body: AccessRequestIn, request: Request, service: AccessRequestServiceDep):
    """Public: anyone on the sign-in page can ask. Nothing is granted until an admin approves."""
    client = request.client.host if request.client else ""
    if not request.app.state.request_limit.allow(client):
        raise TooManyAttempts("Too many requests from this network. Try again in a few minutes.")
    sent = service.submit(body.username, body.password, first_name=body.first_name, last_name=body.last_name,
                          email=body.email)
    return AccessRequestSentOut(username=sent.username)


@router.get("", response_model=list[AccessRequestOut])
def list_requests(_: CurrentAdminDep, service: AccessRequestServiceDep):
    return service.list()


@router.post("/{request_id}/approve", response_model=WifiUserOut, status_code=201)
def approve(request_id: RequestId, body: AccessRequestApproveIn, current: CurrentAdminDep,
            service: AccessRequestServiceDep):
    return service.approve(current.admin.username, request_id, expires_at=body.expires_at,
                           device_limit=body.device_limit)


@router.delete("/{request_id}", status_code=204)
def reject(request_id: RequestId, current: CurrentAdminDep, service: AccessRequestServiceDep) -> None:
    service.reject(current.admin.username, request_id)
