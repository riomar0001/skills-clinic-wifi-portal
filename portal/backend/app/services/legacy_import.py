"""One-time import of people added before the portal existed (the old users file)."""

import re

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import WifiUser
from app.repositories.activity import ActivityRepository, MetaRepository
from app.repositories.wifi_users import WifiUserRepository

_LINE_RE = re.compile(r"^([a-z0-9][a-z0-9._-]{0,31})\s+NT-Password\s*:=\s*0x([0-9A-Fa-f]{32})\s*$")
_DONE_KEY = "legacy_users_imported"


def import_legacy_users(db: Session, settings: Settings) -> int:
    meta = MetaRepository(db)
    if meta.get(_DONE_KEY):
        return 0
    try:
        lines = settings.users_file.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        lines = []

    users = WifiUserRepository(db)
    imported = 0
    for line in lines:
        m = _LINE_RE.match(line.strip())
        if not m or users.get(m[1]) is not None:
            continue
        users.add(WifiUser(username=m[1], nt_hash=m[2].upper(), note="Imported from the old user list"))
        imported += 1
    if imported:
        ActivityRepository(db).add("system", "wifi.import", f"{imported} user(s)")
    meta.set(_DONE_KEY, "1")
    db.commit()
    return imported
