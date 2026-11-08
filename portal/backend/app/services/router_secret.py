"""Shows the router secret (data/clients.conf) to an admin who re-enters their password."""

import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import NotAuthenticated, NotFound, TooManyAttempts
from app.db.models import Admin
from app.repositories.activity import ActivityRepository
from app.services.admin_password import admin_password_matches
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
        # Wrong guesses here count toward the same lockout as signing in.
        if (wait := self.throttle.seconds_locked(admin.username)) > 0:
            raise TooManyAttempts(f"Too many wrong passwords. Try again in {wait // 60 + 1} minute(s).")
        if not admin_password_matches(self.db, admin, password or ""):
            self.throttle.failed(admin.username)
            raise NotAuthenticated("Your password is wrong.")
        self.throttle.succeeded(admin.username)

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
