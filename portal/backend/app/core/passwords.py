"""Input rules and password hashing for admins (PBKDF2) and Wi-Fi users (NT hash for PEAP)."""

import hashlib
import hmac
import re
import secrets

from Crypto.Hash import MD4

from app.core.errors import InvalidInput

USERNAME_PATTERN = r"^[a-z0-9][a-z0-9._-]{0,31}$"
_USERNAME_RE = re.compile(USERNAME_PATTERN)
_WIFI_PASSWORD_RE = re.compile(r"^[\x20-\x7e]{8,64}$")
ADMIN_PASSWORD_MIN, ADMIN_PASSWORD_MAX = 10, 128
NOTE_MAX = 300
PBKDF2_ITERATIONS = 600_000


EMAIL_DOMAIN = "umindanao.edu.ph"
_EMAIL_RE = re.compile(r"^[a-z0-9][a-z0-9._%+-]{0,63}@" + re.escape(EMAIL_DOMAIN) + "$")
NAME_PART_MAX = 60


def check_username(name: str, label: str = "Username") -> str:
    if not isinstance(name, str) or not _USERNAME_RE.match(name):
        raise InvalidInput(f"{label} must be 1-32 characters: lowercase letters, digits, dot, dash "
                           "or underscore, starting with a letter or digit.")
    return name


def check_email(email: str) -> str:
    """A UMindanao address, stored in lowercase."""
    email = (email or "").strip().lower()
    if not _EMAIL_RE.match(email):
        raise InvalidInput(f"Email must be a UMindanao address ending in @{EMAIL_DOMAIN}.")
    return email


def check_name_part(value: str | None, field: str) -> str:
    value = clean_text(value, field, NAME_PART_MAX)
    if not value:
        raise InvalidInput(f"{field} is required.")
    return value


def clean_text(value: str | None, field: str, limit: int) -> str:
    value = (value or "").strip()
    if len(value) > limit:
        raise InvalidInput(f"{field} can be at most {limit} characters.")
    if any(ord(c) < 32 for c in value):
        raise InvalidInput(f"{field} can't contain line breaks or control characters.")
    return value


def check_wifi_password(password: str) -> str:
    if not isinstance(password, str) or not _WIFI_PASSWORD_RE.match(password):
        raise InvalidInput("Wi-Fi password must be 8-64 plain keyboard characters (no accents or emoji).")
    return password


def check_admin_password(password: str) -> str:
    if not isinstance(password, str) or not ADMIN_PASSWORD_MIN <= len(password) <= ADMIN_PASSWORD_MAX:
        raise InvalidInput(f"Admin password must be {ADMIN_PASSWORD_MIN}-{ADMIN_PASSWORD_MAX} characters.")
    return password


# No look-alike characters (0/O, 1/l/I), so a password read off a list is typed correctly.
_EASY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def generate_wifi_password() -> str:
    """Easy-to-type random password like "kp7r-m2xw-9qfa" (about 59 bits), same style as the UI's."""
    return "-".join("".join(secrets.choice(_EASY_ALPHABET) for _ in range(4)) for _ in range(3))


def nt_hash(password: str) -> str:
    """What PEAP/MSCHAPv2 checks against: MD4 of the UTF-16LE password, uppercase hex."""
    check_wifi_password(password)
    return MD4.new(password.encode("utf-16-le")).hexdigest().upper()


def hash_admin_password(password: str) -> str:
    check_admin_password(password)
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_admin_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_hex, hash_hex = stored.split("$")
        iterations = int(iterations)
        if algo != "pbkdf2_sha256" or not 100_000 <= iterations <= 5_000_000:
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), iterations)
    except (ValueError, AttributeError):
        return False
    return hmac.compare_digest(digest.hex(), hash_hex)


# Admin.password_hash of a Wi-Fi user promoted to admin: they sign in with their Wi-Fi password.
# Not a valid PBKDF2 string, so verify_admin_password never accepts anything for it.
WIFI_LINKED_HASH = "wifi-linked"

# Checked when a username doesn't exist, so a wrong username takes as long as a wrong password.
DUMMY_ADMIN_HASH = hash_admin_password(secrets.token_urlsafe(16))


def hash_token(token: str) -> str:
    """Session tokens are stored hashed, so a copied database can't be used to sign in."""
    return hashlib.sha256(token.encode()).hexdigest()
