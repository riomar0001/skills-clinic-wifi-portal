"""Shows the router secret (data/clients.conf) to an admin who re-enters their password."""

import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import NotFound
from app.db.models import Admin
from app.repositories.activity import ActivityRepository
from app.services.admin_password import confirm_admin_password
from app.services.auth import LoginThrottle

MAX_FILE_BYTES = 16 * 1024
_SECRET_RE = re.compile(r"^\s*secret\s*=\s*(\S+)\s*$", re.MULTILINE)


@dataclass(frozen=True)
class RouterSecret:
    secret: str
    clients_conf: str


class RouterSecretService:
    def __init__(self, db: Session, settings: Settings, throttle: LoginThrottle):
        self.db = db
        self.settings = settings
        self.throttle = throttle

    def reveal(self, admin: Admin, password: str) -> RouterSecret:
        confirm_admin_password(self.db, admin, password, self.throttle)

        try:
            raw = self.settings.clients_file.read_bytes()[:MAX_FILE_BYTES]
        except OSError as e:
            raise NotFound("Can't read data/clients.conf. Run setup.ps1 on the server.") from e
        text = raw.decode("utf-8", errors="replace")
        match = _SECRET_RE.search(text)
        if not match:
            raise NotFound("data/clients.conf has no secret line. Run setup.ps1 on the server.")

        ActivityRepository(self.db).add(admin.username, "admin.reveal_secret", "router secret")
        self.db.commit()
        return RouterSecret(secret=match.group(1), clients_conf=text)
