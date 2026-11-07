from fastapi import APIRouter, Request, Response

from app.api.deps import SESSION_COOKIE, AuthServiceDep, CurrentAdminDep, SettingsDep
from app.api.schemas import AuthStatus, LoginIn, SetupIn
from app.core.config import Settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    # No max-age: the cookie ends with the browser; the server also expires idle sessions.
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="strict",
                        secure=settings.cookie_secure, path="/")


@router.get("/status", response_model=AuthStatus)
def status(request: Request, auth: AuthServiceDep) -> AuthStatus:
    if auth.needs_setup():
        return AuthStatus(needs_setup=True, admin=None)
    resolved = auth.resolve(request.cookies.get(SESSION_COOKIE))
    return AuthStatus(needs_setup=False, admin=resolved[0].username if resolved else None)


@router.post("/setup", response_model=AuthStatus)
def setup(body: SetupIn, response: Response, auth: AuthServiceDep, settings: SettingsDep) -> AuthStatus:
    token = auth.setup_first_admin(body.setup_code, body.username.strip(), body.password)
    _set_session_cookie(response, token, settings)
    return AuthStatus(needs_setup=False, admin=body.username.strip())


@router.post("/login", response_model=AuthStatus)
def login(body: LoginIn, response: Response, auth: AuthServiceDep, settings: SettingsDep) -> AuthStatus:
    token = auth.login(body.username, body.password)
    _set_session_cookie(response, token, settings)
    return AuthStatus(needs_setup=False, admin=body.username.strip())


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, auth: AuthServiceDep) -> None:
    auth.logout(request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=AuthStatus)
def me(current: CurrentAdminDep) -> AuthStatus:
    return AuthStatus(needs_setup=False, admin=current.admin.username)
