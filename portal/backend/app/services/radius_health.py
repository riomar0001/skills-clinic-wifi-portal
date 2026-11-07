"""Is the login server answering? Sends a real RADIUS Access-Request for a user that can't exist
and expects an Access-Reject signed with the shared secret: proves the server is up and the secret matches."""

import hashlib
import hmac
import re
import secrets
import socket
import struct
import threading
import time
from dataclasses import dataclass

from app.core.config import Settings

ACCESS_REQUEST, ACCESS_ACCEPT, ACCESS_REJECT = 1, 2, 3
ATTR_USER_NAME, ATTR_USER_PASSWORD, ATTR_MESSAGE_AUTHENTICATOR = 1, 2, 80
PROBE_USER = "portal-health-check"  # not a valid username, so it can never match a real person
CACHE_SECONDS = 10
TIMEOUT_SECONDS = 2.0


@dataclass(frozen=True)
class RadiusHealth:
    ok: bool
    detail: str


def _read_secret(settings: Settings) -> bytes | None:
    try:
        text = settings.clients_file.read_text(encoding="utf-8")
    except OSError:
        return None
    m = re.search(r"^\s*secret\s*=\s*(\S+)\s*$", text, re.MULTILINE)
    return m.group(1).encode() if m else None


def _attr(kind: int, value: bytes) -> bytes:
    return struct.pack("!BB", kind, len(value) + 2) + value


def _hide_password(password: bytes, secret: bytes, authenticator: bytes) -> bytes:
    padded = password + b"\0" * (-len(password) % 16)
    out, prev = b"", authenticator
    for i in range(0, len(padded), 16):
        key = hashlib.md5(secret + prev).digest()
        block = bytes(a ^ b for a, b in zip(padded[i:i + 16], key))
        out += block
        prev = block
    return out


def build_request(secret: bytes, identifier: int, authenticator: bytes) -> bytes:
    attrs = (_attr(ATTR_USER_NAME, PROBE_USER.encode())
             + _attr(ATTR_USER_PASSWORD, _hide_password(secrets.token_bytes(12), secret, authenticator))
             + _attr(ATTR_MESSAGE_AUTHENTICATOR, b"\0" * 16))
    header = struct.pack("!BBH", ACCESS_REQUEST, identifier, 20 + len(attrs)) + authenticator
    unsigned = header + attrs
    mac = hmac.new(secret, unsigned, hashlib.md5).digest()
    return unsigned[:-16] + mac


def verify_response(data: bytes, secret: bytes, identifier: int, authenticator: bytes) -> int | None:
    """The reply's code if it is a genuine reply to our request, else None."""
    if len(data) < 20:
        return None
    code, ident, length = struct.unpack("!BBH", data[:4])
    if ident != identifier or length != len(data) or length > 4096:
        return None
    expected = hashlib.md5(data[:4] + authenticator + data[20:] + secret).digest()
    if not hmac.compare_digest(expected, data[4:20]):
        return None
    return code


class RadiusHealthChecker:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._lock = threading.Lock()
        self._cached: tuple[float, RadiusHealth] | None = None

    def check(self) -> RadiusHealth:
        with self._lock:
            if self._cached and time.monotonic() - self._cached[0] < CACHE_SECONDS:
                return self._cached[1]
            result = self._probe()
            self._cached = (time.monotonic(), result)
            return result

    def _probe(self) -> RadiusHealth:
        secret = _read_secret(self.settings)
        if not secret:
            return RadiusHealth(False, "Can't read the router secret (clients.conf). Run setup.ps1.")
        identifier, authenticator = secrets.randbelow(256), secrets.token_bytes(16)
        packet = build_request(secret, identifier, authenticator)
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.settimeout(TIMEOUT_SECONDS)
                sock.sendto(packet, (self.settings.radius_host, self.settings.radius_port))
                data, _ = sock.recvfrom(4096)
        except socket.gaierror:
            return RadiusHealth(False, f"Can't find the login server '{self.settings.radius_host}'.")
        except (TimeoutError, socket.timeout):
            return RadiusHealth(False, "The login server didn't answer.")
        except OSError as e:
            return RadiusHealth(False, f"Can't reach the login server ({e.strerror or e}).")
        code = verify_response(data, secret, identifier, authenticator)
        if code in (ACCESS_REJECT, ACCESS_ACCEPT):
            return RadiusHealth(True, "Answering logins.")
        return RadiusHealth(False, "The login server sent an unexpected reply. Check the router secret.")
