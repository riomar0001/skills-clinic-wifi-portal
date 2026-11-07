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


class CertificateService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def info(self) -> CertificateInfo:
        path = self.settings.certs_dir / "server.pem"
        try:
            certs = x509.load_pem_x509_certificates(path.read_bytes())
        except (OSError, ValueError) as e:
            raise NotFound("The server certificate is missing or unreadable. Run setup.ps1.") from e
        if not certs:
            raise NotFound("The server certificate is missing. Run setup.ps1.")
        cert = certs[0]
        fp = cert.fingerprint(hashes.SHA256()).hex().upper()
        return CertificateInfo(
            name=_common_name(cert.subject),
            issuer=_common_name(cert.issuer),
            expires_at=int(cert.not_valid_after_utc.timestamp()),
            sha256=":".join(fp[i:i + 2] for i in range(0, len(fp), 2)),
        )

    def download(self, filename: str) -> tuple[Path, str]:
        media_type = DOWNLOADS.get(filename)
        if media_type is None:
            raise NotFound("No such file.")
        path = self.settings.certs_dir / filename
        if not path.is_file():
            raise NotFound("The file is missing. Run setup.ps1.")
        return path, media_type


def _common_name(name: x509.Name) -> str:
    attrs = name.get_attributes_for_oid(NameOID.COMMON_NAME)
    return str(attrs[0].value) if attrs else name.rfc4514_string()
