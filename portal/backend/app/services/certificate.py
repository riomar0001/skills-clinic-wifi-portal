import time
from dataclasses import dataclass
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.x509.oid import NameOID

from app.core.config import Settings
from app.core.errors import NotFound

# Only the public CA certificate is downloadable; never the keys next to it.
DOWNLOADS = {"ca.der": "application/x-x509-ca-cert", "ca.pem": "application/x-pem-file"}


@dataclass(frozen=True)
class CertificateInfo:
    name: str
    issuer: str
    expires_at: int
    sha256: str
    trusted: bool  # publicly trusted (Let's Encrypt): devices can check it against their built-in list


class CertificateService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def info(self) -> CertificateInfo:
        """The certificate the login server presents: the Let's Encrypt one when there is a current one
        (the same rule start.sh uses), otherwise the self-made one from setup."""
        trusted = _load(self.settings.letsencrypt_dir / "server.crt")
        if trusted is not None and trusted.not_valid_after_utc.timestamp() > time.time():
            return _describe(trusted, trusted=True)
        # server.crt is the public certificate only; server.pem also holds the private key,
        # which the portal never needs (and, running as non-root, can't read).
        own = _load(self.settings.certs_dir / "server.crt")
        if own is None:
            raise NotFound("The server certificate is missing or unreadable. Run setup.ps1.")
        return _describe(own, trusted=False)

    def download(self, filename: str) -> tuple[Path, str]:
        media_type = DOWNLOADS.get(filename)
        if media_type is None:
            raise NotFound("No such file.")
        path = self.settings.certs_dir / filename
        if not path.is_file():
            raise NotFound("The file is missing. Run setup.ps1.")
        return path, media_type


def _load(path: Path) -> x509.Certificate | None:
    """First certificate in a PEM file (the server's own; the rest is the chain), or None."""
    try:
        certs = x509.load_pem_x509_certificates(path.read_bytes())
    except (OSError, ValueError):
        return None
    return certs[0] if certs else None


def _describe(cert: x509.Certificate, trusted: bool) -> CertificateInfo:
    fp = cert.fingerprint(hashes.SHA256()).hex().upper()
    return CertificateInfo(
        name=_common_name(cert.subject),
        issuer=_common_name(cert.issuer),
        expires_at=int(cert.not_valid_after_utc.timestamp()),
        sha256=":".join(fp[i:i + 2] for i in range(0, len(fp), 2)),
        trusted=trusted,
    )


def _common_name(name: x509.Name) -> str:
    attrs = name.get_attributes_for_oid(NameOID.COMMON_NAME)
    return str(attrs[0].value) if attrs else name.rfc4514_string()
