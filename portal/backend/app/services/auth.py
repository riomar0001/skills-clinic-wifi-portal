"""Signing in and out, sessions, first-time setup and sign-in throttling."""

import secrets
import threading
import time

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import Conflict, Forbidden, NotAuthenticated, TooManyAttempts
from app.core.files import atomic_write
from app.core.passwords import (DUMMY_ADMIN_HASH, check_username, hash_admin_password, hash_token,
                                verify_admin_password)
from app.db.models import Admin, AdminSession, now
from app.repositories.activity import ActivityRepository
from app.repositories.admins import AdminRepository, SessionRepository

LOGIN_MAX_FAILURES = 5
LOGIN_LOCK_SECONDS = 300
MAX_TRACKED_NAMES = 1000
TOUCH_INTERVAL_SECONDS = 60


class LoginThrottle:
    """After 5 wrong passwords for a username, refuse that username for 5 minutes. In memory."""

    def __init__(self):
        self._lock = threading.Lock()
        self._failures: dict[str, list[float]] = {}  # name -> [count, locked_until (monotonic)]

    @staticmethod
    def _key(username: str) -> str:
        return (username or "").strip().lower()[:64]

    def seconds_locked(self, username: str) -> int:
        with self._lock:
            entry = self._failures.get(self._key(username))
            return max(0, int(entry[1] - time.monotonic())) if entry else 0

    def failed(self, username: str) -> None:
        key = self._key(username)
        with self._lock:
            if key not in self._failures and len(self._failures) >= MAX_TRACKED_NAMES:
                self._failures.pop(next(iter(self._failures)))
            entry = self._failures.setdefault(key, [0, 0.0])
            if entry[1] and entry[1] <= time.monotonic():
                entry[:] = [0, 0.0]
            entry[0] += 1
            if entry[0] >= LOGIN_MAX_FAILURES:
                entry[1] = time.monotonic() + LOGIN_LOCK_SECONDS

    def succeeded(self, username: str) -> None:
        with self._lock:
            self._failures.pop(self._key(username), None)


class SetupCode:
    """One-time code, written to the shared data folder, that proves the first admin has access to the PC."""

    def __init__(self, settings: Settings):
        self.path = settings.setup_code_file

    def ensure(self) -> str:
        try:
            existing = self.path.read_text(encoding="utf-8").strip()
        except FileNotFoundError:
            existing = ""
        if len(existing) == 14:
            return existing
        code = "-".join(secrets.token_hex(2).upper() for _ in range(3))
        atomic_write(self.path, code + "\n")
        return code

    def matches(self, given: str) -> bool:
        try:
            expected = self.path.read_text(encoding="utf-8").strip()
        except FileNotFoundError:
            return False
        return bool(expected) and secrets.compare_digest(expected.upper(), (given or "").strip().upper())

    def clear(self) -> None:
        self.path.unlink(missing_ok=True)


class AuthService:
    def __init__(self, db: Session, settings: Settings, throttle: LoginThrottle):
        self.db = db
        self.settings = settings
        self.throttle = throttle
        self.admins = AdminRepository(db)
        self.sessions = SessionRepository(db)
        self.activity = ActivityRepository(db)

    def needs_setup(self) -> bool:
        return self.admins.count() == 0

    def setup_first_admin(self, setup_code: str, username: str, password: str) -> str:
        if not self.needs_setup():
            raise Conflict("Setup is already done. Sign in instead.")
        code = SetupCode(self.settings)
        if not code.matches(setup_code):
            raise Forbidden("The setup code is wrong. Find it in data\\setup-code.txt.")
        check_username(username)
        admin = Admin(username=username, password_hash=hash_admin_password(password))
        self.admins.add(admin)
        self.activity.add(username, "admin.setup", username)
        try:
            self.db.flush()
        except IntegrityError as e:
            self.db.rollback()
            raise Conflict("Setup is already done. Sign in instead.") from e
        token = self._start_session(admin)
        code.clear()
        return token

    def login(self, username: str, password: str) -> str:
        if (wait := self.throttle.seconds_locked(username)) > 0:
            raise TooManyAttempts(f"Too many wrong passwords. Try again in {wait // 60 + 1} minute(s).")
        admin = self.admins.get((username or "").strip())
        ok = verify_admin_password(password or "", admin.password_hash if admin else DUMMY_ADMIN_HASH)
        if not ok or admin is None:
            self.throttle.failed(username)
            raise NotAuthenticated("Wrong username or password.")
        self.throttle.succeeded(username)
        self.activity.add(admin.username, "admin.login", admin.username)
        return self._start_session(admin)

    def logout(self, token: str | None) -> None:
        if token:
            self.sessions.delete(hash_token(token))
            self.db.commit()

    def resolve(self, token: str | None) -> tuple[Admin, str] | None:
        """The signed-in admin and session hash for a cookie token, or None if expired or unknown."""
        if not token or len(token) > 200:
            return None
        token_hash = hash_token(token)
        session = self.sessions.get(token_hash)
        if session is None:
            return None
        current = now()
        if current - session.last_seen_at > self.settings.session_idle_seconds:
            self.sessions.delete(token_hash)
            self.db.commit()
            return None
        admin = self.admins.get_by_id(session.admin_id)
        if admin is None:
            return None
        if current - session.last_seen_at > TOUCH_INTERVAL_SECONDS:
            session.last_seen_at = current
            self.db.commit()
        return admin, token_hash

    def _start_session(self, admin: Admin) -> str:
        token = secrets.token_urlsafe(32)
        self.db.flush()  # assigns admin.id for a brand-new admin
        self.sessions.delete_idle(now() - self.settings.session_idle_seconds)
        self.sessions.add(AdminSession(token_hash=hash_token(token), admin_id=admin.id))
        self.db.commit()
        return token
