"""Wi-Fi access requests: people ask from the sign-in page with the password they want, an admin approves or
rejects. Only the password's NT hash is kept, so approving creates the account without anyone seeing it."""

from __future__ import annotations

import threading
import time

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import Conflict, DomainError, NotFound, TooManyAttempts
from app.core.passwords import check_email, check_name_part, check_username, check_wifi_password, nt_hash
from app.db.models import AccessRequest, WifiUser, now
from app.repositories.access_requests import AccessRequestRepository
from app.repositories.activity import ActivityRepository
from app.repositories.wifi_users import WifiUserRepository
from app.services.radius_export import RadiusUsersExporter
from app.services.wifi_users import EMAIL_TAKEN, ID_LABEL, WifiUserService

# Unanswered requests are dropped after this; the person can simply ask again.
REQUEST_KEEP_SECONDS = 30 * 24 * 3600
# Cap on waiting requests, so a flood from the internet can't fill the database.
MAX_PENDING = 300
APPROVED_NOTE = "Requested access from the sign-in page."


class RequestRateLimit:
    """At most `limit` requests per address within `window` seconds. In memory and bounded.
    Generous on purpose: a whole class behind the clinic's one address may ask at once."""

    def __init__(self, limit: int = 60, window: float = 600, max_tracked: int = 2000):
        self.limit, self.window, self.max_tracked = limit, window, max_tracked
        self._lock = threading.Lock()
        self._hits: dict[str, list[float]] = {}

    def allow(self, client: str) -> bool:
        key = (client or "")[:64]
        at = time.monotonic()
        with self._lock:
            recent = [t for t in self._hits.get(key, []) if at - t < self.window]
            if len(recent) >= self.limit:
                self._hits[key] = recent
                return False
            if key not in self._hits and len(self._hits) >= self.max_tracked:
                self._hits.pop(next(iter(self._hits)))  # forget the oldest address
            recent.append(at)
            self._hits[key] = recent
            return True


class AccessRequestService:
    def __init__(self, db: Session, exporter: RadiusUsersExporter):
        self.db = db
        self.requests = AccessRequestRepository(db)
        self.users = WifiUserRepository(db)
        self.activity = ActivityRepository(db)
        self.exporter = exporter

    def submit(self, username: str, password: str, first_name: str, last_name: str, email: str) -> AccessRequest:
        username = (username or "").strip().lower()
        check_username(username, ID_LABEL)
        request = AccessRequest(
            username=username,
            first_name=check_name_part(first_name, "First name"),
            last_name=check_name_part(last_name, "Last name"),
            email=check_email(email),
            nt_hash=nt_hash(check_wifi_password(password)),
        )
        self.requests.delete_older_than(now() - REQUEST_KEEP_SECONDS)
        if self.users.get(username) is not None:
            raise Conflict("This ID already has Wi-Fi access. Sign in instead, or ask an admin to reset the password.")
        if self.users.get_by_email(request.email) is not None:
            raise Conflict(EMAIL_TAKEN)
        if self.requests.get_by_username(username) is not None:
            raise Conflict("A request for this ID is already waiting for an admin.")
        if self.requests.get_by_email(request.email) is not None:
            raise Conflict("A request with this email is already waiting for an admin.")
        if self.requests.count() >= MAX_PENDING:
            raise TooManyAttempts("Too many requests are waiting for an admin. Try again later.")
        self.requests.add(request)
        self.activity.add(username, "request.create", username)
        self._commit("A request for this ID or email is already waiting for an admin.")
        return request

    def list(self) -> list[AccessRequest]:
        self.requests.delete_older_than(now() - REQUEST_KEEP_SECONDS)
        self.db.commit()
        return self.requests.list()

    def approve(self, actor: str, request_id: int, expires_at: int | None, device_limit: int | None) -> WifiUser:
        """Creates the Wi-Fi account with the password the person chose, and removes the request, in one save."""
        request = self._get(request_id)
        self.requests.delete(request)
        self.activity.add(actor, "request.approve", request.username)
        try:
            # Its commit also saves the two changes above; it refreshes the login server's user list.
            return WifiUserService(self.db, self.exporter).create_with_hash(
                actor, request.username, request.nt_hash, request.first_name, request.last_name, request.email,
                note=APPROVED_NOTE, expires_at=expires_at, device_limit=device_limit)
        except DomainError:
            self.db.rollback()  # keep the request, e.g. if an admin added the same ID meanwhile
            raise

    def reject(self, actor: str, request_id: int) -> None:
        request = self._get(request_id)
        self.requests.delete(request)
        self.activity.add(actor, "request.reject", request.username)
        self._commit("Could not save.")

    def _get(self, request_id: int) -> AccessRequest:
        request = self.requests.get(request_id)
        if request is None:
            raise NotFound("That request no longer exists. Another admin may have answered it.")
        return request

    def _commit(self, conflict_message: str) -> None:
        try:
            self.activity.prune()
            self.db.commit()
        except IntegrityError as e:
            self.db.rollback()
            raise Conflict(conflict_message) from e
