"""Bulk-add Wi-Fi users from a CSV file (e.g. a class list exported from Excel or Google Sheets).

Columns (header names are flexible, any order, extra columns ignored):
  Student/Faculty ID, First name, Last name, UMindanao email, Password (optional: generated if empty).
Every row is checked first; users are only added if all rows are valid (all or nothing).
"""

import csv
import io
import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import Conflict, DomainError, InvalidInput
from app.core.passwords import (check_email, check_name_part, check_username, check_wifi_password,
                                generate_wifi_password, nt_hash)
from app.db.models import WifiUser
from app.repositories.activity import ActivityRepository
from app.services.radius_export import RadiusUsersExporter
from app.services.wifi_users import ID_LABEL, check_device_limit, check_expiry

MAX_ROWS = 1000
MAX_CSV_CHARS = 1_000_000
_ALIASES = {
    "username": {"id", "student id", "faculty id", "student/faculty id", "student id / faculty id",
                 "student id/faculty id", "id number", "username", "student number", "employee id"},
    "first_name": {"first name", "firstname", "first", "given name"},
    "last_name": {"last name", "lastname", "last", "surname", "family name"},
    "email": {"email", "e-mail", "email address", "umindanao email"},
    "password": {"password", "wifi password", "wi-fi password"},
}
_REQUIRED = {"username": ID_LABEL, "first_name": "First name", "last_name": "Last name", "email": "Email"}


@dataclass
class ImportRow:
    line: int  # line number in the file, for error messages
    username: str = ""
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    password: str = ""
    errors: list[str] = field(default_factory=list)


def _column_key(header: str) -> str | None:
    name = re.sub(r"[\s_]+", " ", header.strip().lower())
    return next((key for key, names in _ALIASES.items() if name in names), None)


def parse_csv(text: str) -> list[ImportRow]:
    """Rows from the file. Raises InvalidInput for problems with the whole file (not single rows)."""
    if len(text) > MAX_CSV_CHARS:
        raise InvalidInput("The file is too large (at most about 1 MB).")
    text = text.removeprefix("﻿")  # byte-order mark Excel adds to "CSV UTF-8"
    if not text.strip():
        raise InvalidInput("The file is empty.")
    # Excel saves with ";" in regions that use a decimal comma; pick whichever the header row uses most.
    first_line = text.lstrip().split("\n", 1)[0]
    delimiter = max(",;\t", key=first_line.count)
    try:
        reader = csv.reader(io.StringIO(text), delimiter=delimiter)
        header = next(reader, [])
        columns: dict[int, str] = {}
        for i, name in enumerate(header):
            key = _column_key(name)
            if key is not None and key not in columns.values():
                columns[i] = key
        missing = [label for key, label in _REQUIRED.items() if key not in columns.values()]
        if missing:
            raise InvalidInput(f"The first row must name the columns. Missing: {', '.join(missing)}.")

        rows: list[ImportRow] = []
        for values in reader:
            if not any(v.strip() for v in values):
                continue  # blank line
            if len(rows) >= MAX_ROWS:
                raise InvalidInput(f"At most {MAX_ROWS} people per file. Split it into smaller files.")
            row = ImportRow(line=reader.line_num)
            for i, key in columns.items():
                setattr(row, key, values[i].strip() if i < len(values) else "")
            rows.append(row)
    except csv.Error as e:
        raise InvalidInput(f"The file isn't a valid CSV file ({e}).") from e
    if not rows:
        raise InvalidInput("The file has no people in it, only the header row.")
    return rows


def _check_row(row: ImportRow) -> None:
    """Normalizes the row in place and records every problem, not just the first."""
    def attempt(fn):
        try:
            return fn()
        except DomainError as e:
            row.errors.append(e.message)
            return None

    row.username = attempt(lambda: check_username(row.username.lower(), ID_LABEL)) or row.username
    row.first_name = attempt(lambda: check_name_part(row.first_name, "First name")) or row.first_name
    row.last_name = attempt(lambda: check_name_part(row.last_name, "Last name")) or row.last_name
    row.email = attempt(lambda: check_email(row.email)) or row.email
    if row.password:
        attempt(lambda: check_wifi_password(row.password))


def _check_duplicates(db: Session, rows: list[ImportRow]) -> None:
    ids = {r.username for r in rows if r.username}
    emails = {r.email for r in rows if r.email}
    taken_ids = set(db.scalars(select(WifiUser.username).where(WifiUser.username.in_(ids)))) if ids else set()
    taken_emails = set(db.scalars(select(WifiUser.email).where(WifiUser.email.in_(emails)))) if emails else set()
    first_line_of_id: dict[str, int] = {}
    first_line_of_email: dict[str, int] = {}
    for row in rows:
        if row.username in taken_ids:
            row.errors.append(f"ID {row.username} already has a Wi-Fi account.")
        elif row.username and row.username in first_line_of_id:
            row.errors.append(f"ID {row.username} is also on line {first_line_of_id[row.username]}.")
        if row.email in taken_emails:
            row.errors.append(f"{row.email} already belongs to a Wi-Fi user.")
        elif row.email and row.email in first_line_of_email:
            row.errors.append(f"{row.email} is also on line {first_line_of_email[row.email]}.")
        first_line_of_id.setdefault(row.username, row.line)
        first_line_of_email.setdefault(row.email, row.line)


def import_users(db: Session, exporter: RadiusUsersExporter, actor: str, text: str, *,
                 expires_at: int | None, device_limit: int | None, commit: bool) -> tuple[list[ImportRow], int]:
    """Checks every row; with commit=True and no errors, adds them all. Returns (rows, number added).
    Empty passwords are generated on commit and returned in the rows (shown to the admin once)."""
    expires_at = check_expiry(expires_at)
    device_limit = check_device_limit(device_limit)
    rows = parse_csv(text)
    for row in rows:
        _check_row(row)
    _check_duplicates(db, rows)
    if not commit or any(r.errors for r in rows):
        return rows, 0

    for row in rows:
        row.password = row.password or generate_wifi_password()
        db.add(WifiUser(username=row.username, first_name=row.first_name, last_name=row.last_name,
                        email=row.email, note="Added from a CSV file", nt_hash=nt_hash(row.password),
                        enabled=True, expires_at=expires_at, device_limit=device_limit))
    ActivityRepository(db).add(actor, "wifi.csv_import", f"{len(rows)} user(s)")
    try:
        db.commit()
    except IntegrityError as e:  # the same ID or email was added by someone else meanwhile
        db.rollback()
        raise Conflict("Some of these IDs or emails were just added by someone else. Check the file again.") from e
    exporter.export(db)
    return rows, len(rows)
