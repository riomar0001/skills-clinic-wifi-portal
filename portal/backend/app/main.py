"""App factory. Run with: uvicorn --factory app.main:create_app"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.middleware import GuardMiddleware
from app.api.routes import admins, auth, system, wifi_users
from app.core.config import Settings, load_settings
from app.core.errors import DomainError
from app.db.migrate import upgrade_to_latest
from app.db.session import make_engine, make_session_factory
from app.services.auth import AuthService, LoginThrottle, SetupCode
from app.services.legacy_import import import_legacy_users
from app.services.radius_export import RadiusUsersExporter
from app.services.radius_health import RadiusHealthChecker

log = logging.getLogger("wifi_portal")


def _startup(app: FastAPI, settings: Settings) -> None:
    upgrade_to_latest(settings.db_path)
    with app.state.session_factory() as db:
        if imported := import_legacy_users(db, settings):
            log.warning("Imported %d Wi-Fi user(s) from the old user list.", imported)
        app.state.exporter.export(db)
        if AuthService(db, settings, app.state.throttle).needs_setup():
            code = SetupCode(settings).ensure()
            log.warning("No admin yet. First-time setup code: %s (also in data/setup-code.txt)", code)
        else:
            SetupCode(settings).clear()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    engine = make_engine(settings.db_path)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        _startup(app, settings)
        yield
        engine.dispose()

    app = FastAPI(title="Wi-Fi Portal", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.state.settings = settings
    app.state.session_factory = make_session_factory(engine)
    app.state.throttle = LoginThrottle()
    app.state.exporter = RadiusUsersExporter(settings)
    app.state.health = RadiusHealthChecker(settings)

    app.add_middleware(GuardMiddleware, max_body_bytes=settings.max_body_bytes)

    @app.exception_handler(DomainError)
    async def _domain_error(_: Request, exc: DomainError):
        return JSONResponse({"detail": exc.message}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        fields = sorted({str(e["loc"][-1]) for e in exc.errors() if e.get("loc")})
        message = f"Please check: {', '.join(fields)}." if fields else "Some fields are invalid."
        return JSONResponse({"detail": message}, status_code=422)

    for module in (auth, wifi_users, admins, system):
        app.include_router(module.router)

    _mount_frontend(app, settings)
    return app


def _mount_frontend(app: FastAPI, settings: Settings) -> None:
    """Serve the built React app; any non-API path returns index.html so client routes work on reload."""
    static = settings.static_dir
    if static is None or not (static / "index.html").is_file():
        return
    if (static / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")
    index = static / "index.html"

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/") or path == "api":
            return JSONResponse({"detail": "Not found."}, status_code=404)
        candidate = (static / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(static.resolve()):
            return FileResponse(candidate)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
