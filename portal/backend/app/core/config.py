"""Settings, read once from environment variables."""

import os
from dataclasses import dataclass
from pathlib import Path


def _env_int(name: str, default: int, low: int, high: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    if not raw.isdigit():
        raise ValueError(f"{name} must be a whole number, got {raw!r}")
    value = int(raw)
    if not low <= value <= high:
        raise ValueError(f"{name} must be between {low} and {high}, got {value}")
    return value


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name, "").strip().lower()
    if raw == "":
        return default
    if raw in ("1", "true", "yes"):
        return True
    if raw in ("0", "false", "no"):
        return False
    raise ValueError(f"{name} must be true or false, got {raw!r}")


@dataclass(frozen=True)
class Settings:
    db_path: Path
    radius_dir: Path            # shared with the radius container: users file, certs, clients.conf
    static_dir: Path | None     # built React app; None in tests
    radius_host: str
    radius_port: int
    admin_port: int = 8080
    # Second listener that serves only the Wi-Fi user "change my password" page; 0 turns it off.
    self_service_port: int = 0
    session_idle_seconds: int = 8 * 3600
    cookie_secure: bool = False  # True only when served over HTTPS
    max_body_bytes: int = 16 * 1024

    @property
    def users_file(self) -> Path:
        return self.radius_dir / "users"

    @property
    def clients_file(self) -> Path:
        return self.radius_dir / "clients.conf"

    @property
    def certs_dir(self) -> Path:
        return self.radius_dir / "certs"

    @property
    def setup_code_file(self) -> Path:
        return self.radius_dir / "setup-code.txt"


def load_settings() -> Settings:
    static = os.environ.get("PORTAL_STATIC_DIR", "/srv/portal/web")
    return Settings(
        db_path=Path(os.environ.get("PORTAL_DB_PATH", "/var/lib/portal/portal.db")),
        radius_dir=Path(os.environ.get("RADIUS_DATA_DIR", "/mnt/radius")),
        static_dir=Path(static) if static else None,
        radius_host=os.environ.get("RADIUS_HOST", "radius"),
        radius_port=_env_int("RADIUS_PORT", 1812, 1, 65535),
        admin_port=_env_int("PORTAL_ADMIN_PORT", 8080, 1, 65535),
        self_service_port=_env_int("PORTAL_SELF_SERVICE_PORT", 0, 0, 65535),
        session_idle_seconds=_env_int("PORTAL_SESSION_IDLE_SECONDS", 8 * 3600, 300, 7 * 24 * 3600),
        cookie_secure=_env_bool("PORTAL_COOKIE_SECURE", False),
    )
