from fastapi import APIRouter, Request, Response

from app.api.deps import SESSION_COOKIE, AuthServiceDep, CurrentAdminDep, SettingsDep
from app.api.schemas import AuthStatus, LoginIn, SetupIn
from app.core.config import Settings
from app.services.auth import Identity

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    # No max-age: the cookie ends with the browser; the server also expires idle sessions.
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="strict",
                        secure=settings.cookie_secure, path="/")


def _status(identity: Identity | None) -> AuthStatus:
    if identity is None:
        return AuthStatus(needs_setup=False, role=None, username=None, name=None)
    return AuthStatus(needs_setup=False, role=identity.role, username=identity.username, name=identity.name)


@router.get("/status", response_model=AuthStatus)
def status(request: Request, auth: AuthServiceDep) -> AuthStatus:
    if auth.needs_setup():
        return AuthStatus(needs_setup=True, role=None, username=None, name=None)
    return _status(auth.identify(request.cookies.get(SESSION_COOKIE)))


@router.post("/setup", response_model=AuthStatus)
def setup(body: SetupIn, response: Response, auth: AuthServiceDep, settings: SettingsDep) -> AuthStatus:
    username = body.username.strip()
    token = auth.setup_first_admin(body.setup_code, username, body.password)
    _set_session_cookie(response, token, settings)
    return _status(Identity("admin", username, username))


@router.post("/login", response_model=AuthStatus)
def login(body: LoginIn, request: Request, response: Response, auth: AuthServiceDep,
          settings: SettingsDep) -> AuthStatus:
    """One page for everyone: an admin username or a Student/Faculty ID, with the matching password."""
    token, identity = auth.login(body.username, body.password, request.client.host if request.client else "")
    _set_session_cookie(response, token, settings)
    return _status(identity)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, auth: AuthServiceDep) -> None:
    auth.logout(request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=AuthStatus)
def me(current: CurrentAdminDep) -> AuthStatus:
    """Admins only; Wi-Fi users use /api/me."""
    return _status(Identity("admin", current.admin.username, current.admin.username))
