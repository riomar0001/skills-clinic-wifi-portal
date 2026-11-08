"""Signing in and out (admins and Wi-Fi users share one page), sessions, first-time setup, throttling."""

import hmac
import math
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import Conflict, Forbidden, InvalidInput, NotAuthenticated, TooManyAttempts
from app.core.files import atomic_write
from app.core.passwords import (DUMMY_ADMIN_HASH, check_username, hash_admin_password, hash_token, nt_hash,
                                verify_admin_password)
from app.db.models import Admin, AdminSession, WifiUser, WifiUserSession, now
from app.repositories.access_requests import AccessRequestRepository
from app.repositories.activity import ActivityRepository
from app.repositories.admins import AdminRepository, SessionRepository, WifiSessionRepository
from app.repositories.wifi_users import WifiUserRepository
from app.services.admin_password import admin_password_matches

LOGIN_MAX_FAILURES = 5          # per name + address
LOGIN_LOCK_SECONDS = 300
ACCOUNT_MAX_FAILURES = 20       # per name, from any address
ACCOUNT_LOCK_SECONDS = 900
LOGIN_WINDOW_SECONDS = 900      # failures older than this are forgotten
MAX_TRACKED_KEYS = 10_000       # per table; a few MB at most
SATURATED_WAIT_SECONDS = 60     # when every slot holds an active lock (an attack in progress)
TOUCH_INTERVAL_SECONDS = 60
_DUMMY_NT_HASH = "0" * 32

Role = Literal["admin", "wifi"]


@dataclass(frozen=True)
class Identity:
    role: Role
    username: str
    name: str  # what to greet them with


def _wifi_identity(user: WifiUser) -> Identity:
    return Identity("wifi", user.username, f"{user.first_name} {user.last_name}".strip() or user.username)


class _FailureTable:
    """Wrong-password counts per key: `limit` failures within `window` seconds lock the key for `lock` seconds.
    Bounded, and an active lock is never dropped to make room: when every slot holds one, new keys are
    refused instead (fail closed), so flooding it with made-up names can't clear a lock."""

    def __init__(self, limit: int, window: float, lock: float, capacity: int):
        self.limit, self.window, self.lock, self.capacity = limit, window, lock, capacity
        self._entries: dict[str, list[float]] = {}  # key -> [count, first failure, locked until] (monotonic)

    def seconds_locked(self, key: str, at: float) -> int:
        entry = self._entries.get(key)
        if entry is not None:
            return max(0, math.ceil(entry[2] - at))
        return SATURATED_WAIT_SECONDS if not self._make_room(at) else 0

    def failed(self, key: str, at: float) -> None:
        entry = self._entries.get(key)
        if entry is None:
            if not self._make_room(at):
                return  # full of active locks; seconds_locked already refuses new keys
            entry = self._entries[key] = [0, at, 0.0]
        elif entry[2] <= at and at - entry[1] >= self.window:
            entry[:] = [0, at, 0.0]  # old failures, or a lock that has run out: start over
        entry[0] += 1
        if entry[0] >= self.limit and entry[2] <= at:
            entry[2] = at + self.lock

    def clear(self, key: str) -> None:
        self._entries.pop(key, None)

    def _make_room(self, at: float) -> bool:
        """True if a new key fits: forgets finished entries first, then the oldest one that isn't locked."""
        if len(self._entries) < self.capacity:
            return True
        for key in [k for k, (_, first, until) in self._entries.items() if until <= at and at - first >= self.window]:
            del self._entries[key]
        if len(self._entries) < self.capacity:
            return True
        oldest_unlocked = next((k for k, (_, _, until) in self._entries.items() if until <= at), None)
        if oldest_unlocked is None:
            return False
        del self._entries[oldest_unlocked]
        return True


class LoginThrottle:
    """Wrong-password locks, in memory. Keys are a name, or "name|address" at sign-in.

    - name|address: 5 wrong passwords in 15 minutes lock that pair for 5 minutes, so someone guessing from
      their own device can't lock the real person out.
    - name alone, from any address: 20 in 15 minutes lock the account for 15 minutes, so guesses spread over
      many addresses (easy from the internet) are limited too. The price: such an attack can lock the real
      person out for a while; restarting the portal clears every lock.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._pairs = _FailureTable(LOGIN_MAX_FAILURES, LOGIN_WINDOW_SECONDS, LOGIN_LOCK_SECONDS, MAX_TRACKED_KEYS)
        self._accounts = _FailureTable(ACCOUNT_MAX_FAILURES, LOGIN_WINDOW_SECONDS, ACCOUNT_LOCK_SECONDS,
                                       MAX_TRACKED_KEYS)

    @staticmethod
    def _keys(key: str) -> tuple[str, str]:
        key = (key or "").strip().lower()[:130]
        return key, key.split("|", 1)[0]

    def seconds_locked(self, key: str) -> int:
        pair, account = self._keys(key)
        at = time.monotonic()
        with self._lock:
            return max(self._pairs.seconds_locked(pair, at), self._accounts.seconds_locked(account, at))

    def failed(self, key: str) -> None:
        pair, account = self._keys(key)
        at = time.monotonic()
        with self._lock:
            self._pairs.failed(pair, at)
            self._accounts.failed(account, at)

    def succeeded(self, key: str) -> None:
        pair, account = self._keys(key)
        with self._lock:
            self._pairs.clear(pair)
            self._accounts.clear(account)


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
        self.wifi_users = WifiUserRepository(db)
        self.wifi_sessions = WifiSessionRepository(db)
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

    def login(self, username: str, password: str, client: str = "") -> tuple[str, Identity]:
        """One sign-in page for everyone: admin accounts are checked first, then Wi-Fi users
        (Student/Faculty ID + Wi-Fi password). Both checks always run, so timing doesn't reveal which exists.
        client is the caller's address: the lockout is per name *and* address, so someone guessing from their
        own laptop can't lock the real admin out of the portal."""
        name = (username or "").strip()
        password = password or ""
        throttle_key = f"{name[:64]}|{client[:64]}"
        if (wait := self.throttle.seconds_locked(throttle_key)) > 0:
            raise TooManyAttempts(f"Too many wrong passwords. Try again in {wait // 60 + 1} minute(s).")

        admin = self.admins.get(name)
        admin_ok = (admin_password_matches(self.db, admin, password) if admin is not None
                    else verify_admin_password(password, DUMMY_ADMIN_HASH))
        wifi_user = self.wifi_users.get(name.lower())
        try:
            given = nt_hash(password)
        except InvalidInput:
            given = ""  # not a possible Wi-Fi password
        stored = wifi_user.nt_hash if wifi_user is not None else _DUMMY_NT_HASH
        # Disabled accounts can't sign in; expired ones can, to see why the Wi-Fi refuses them.
        wifi_ok = bool(given) and hmac.compare_digest(given, stored) and wifi_user is not None and wifi_user.enabled

        if admin is not None and admin_ok:
            self.throttle.succeeded(throttle_key)
            self.activity.add(admin.username, "admin.login", admin.username)
            return self._start_session(admin), Identity("admin", admin.username, admin.username)
        if wifi_ok:
            self.throttle.succeeded(throttle_key)
            return self._start_wifi_session(wifi_user), _wifi_identity(wifi_user)
        # Only someone who knows the requested password learns that the request is still waiting.
        pending = AccessRequestRepository(self.db).get_by_username(name.lower()) if given else None
        if pending is not None and hmac.compare_digest(given, pending.nt_hash):
            raise Forbidden("Your access request is still waiting for an admin. You can sign in once it's approved.")
        self.throttle.failed(throttle_key)
        raise NotAuthenticated("Wrong ID, username or password.")

    def identify(self, token: str | None) -> Identity | None:
        """Who a session cookie belongs to, admin or Wi-Fi user."""
        if (admin := self.resolve(token)) is not None:
            return Identity("admin", admin[0].username, admin[0].username)
        if (wifi := self.resolve_wifi_user(token)) is not None:
            return _wifi_identity(wifi[0])
        return None

    def logout(self, token: str | None) -> None:
        if token and len(token) <= 200:
            token_hash = hash_token(token)
            self.sessions.delete(token_hash)
            self.wifi_sessions.delete(token_hash)
            self.db.commit()

    def resolve_wifi_user(self, token: str | None) -> tuple[WifiUser, str] | None:
        """The signed-in Wi-Fi user and session hash, or None. Ends the session if the account was disabled."""
        if not token or len(token) > 200:
            return None
        token_hash = hash_token(token)
        session = self.wifi_sessions.get(token_hash)
        if session is None:
            return None
        current = now()
        user = self.db.get(WifiUser, session.wifi_user_id)
        if user is None or not user.enabled or current - session.last_seen_at > self.settings.session_idle_seconds:
            self.wifi_sessions.delete(token_hash)
            self.db.commit()
            return None
        if current - session.last_seen_at > TOUCH_INTERVAL_SECONDS:
            session.last_seen_at = current
            self.db.commit()
        return user, token_hash

    def _start_wifi_session(self, user: WifiUser) -> str:
        token = secrets.token_urlsafe(32)
        self.wifi_sessions.delete_idle(now() - self.settings.session_idle_seconds)
        self.wifi_sessions.add(WifiUserSession(token_hash=hash_token(token), wifi_user_id=user.id))
        self.db.commit()
        return token

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
