"""Wi-Fi login history: imports the lines FreeRADIUS writes (wifi-events.conf) into the database.

Each line is   <unix time> TAB <accept|reject> TAB <username> TAB <device MAC>.
Import is incremental (a byte offset kept in the meta table) and runs before history is read.
"""

import re
import threading
import time

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import ConnectionEvent
from app.repositories.activity import MetaRepository

MAX_READ_BYTES = 1024 * 1024
KEEP_SECONDS = 90 * 86400
KEEP_ROWS = 50_000
_OFFSET_KEY = "connection_log_offset"
_USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,31}$")
_DEVICE_RE = re.compile(r"^[0-9A-Fa-f:.\-]{0,32}$")
# One import at a time, so two requests can't insert the same lines twice.
_import_lock = threading.Lock()


def parse_line(line: str) -> ConnectionEvent | None:
    """A ConnectionEvent for a well-formed line, None for anything else (it's skipped)."""
    parts = line.rstrip("\r").split("\t")
    if len(parts) != 4:
        return None
    at, result, username, device = parts
    username = username.strip().lower()
    if not at.isdigit() or result not in ("accept", "reject") or not _USERNAME_RE.match(username):
        return None
    if not _DEVICE_RE.match(device):
        device = ""
    return ConnectionEvent(at=int(at), username=username, accepted=result == "accept", device=device.upper())


class ConnectionLogService:
    def __init__(self, db: Session, settings: Settings):
        self.db = db
        self.path = settings.radius_events_file

    def import_new(self) -> int:
        if self.path is None:
            return 0
        with _import_lock:
            return self._import_locked()

    def _import_locked(self) -> int:
        meta = MetaRepository(self.db)
        offset = int(meta.get(_OFFSET_KEY) or 0)
        try:
            with open(self.path, "rb") as f:
                size = f.seek(0, 2)
                if size < offset:
                    offset = 0  # the file was emptied (size cap); start again from the top
                f.seek(offset)
                chunk = f.read(MAX_READ_BYTES)
        except FileNotFoundError:
            return 0
        # Only whole lines; a half-written last line is picked up next time.
        end = chunk.rfind(b"\n")
        if end < 0:
            return 0
        events = [e for raw in chunk[:end].split(b"\n")
                  if (e := parse_line(raw.decode("utf-8", errors="replace")))]
        self.db.add_all(events)
        meta.set(_OFFSET_KEY, str(offset + end + 1))
        self._prune()
        self.db.commit()
        return len(events)

    def _prune(self) -> None:
        self.db.execute(delete(ConnectionEvent).where(ConnectionEvent.at < int(time.time()) - KEEP_SECONDS))
        cutoff = self.db.scalar(select(ConnectionEvent.id).order_by(ConnectionEvent.id.desc())
                                .offset(KEEP_ROWS).limit(1))
        if cutoff is not None:
            self.db.execute(delete(ConnectionEvent).where(ConnectionEvent.id <= cutoff))

    def for_user(self, username: str, limit: int = 100) -> list[ConnectionEvent]:
        self.import_new()
        limit = max(1, min(limit, 500))
        stmt = (select(ConnectionEvent).where(ConnectionEvent.username == username)
                .order_by(ConnectionEvent.at.desc(), ConnectionEvent.id.desc()).limit(limit))
        return list(self.db.scalars(stmt))

    def last_success(self, username: str) -> int | None:
        return self.db.scalar(select(func.max(ConnectionEvent.at))
                              .where(ConnectionEvent.username == username, ConnectionEvent.accepted.is_(True)))
