import datetime as dt

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID


def _write_letsencrypt(settings, days: int) -> None:
    """A stand-in for the certs container's output: leaf + intermediate, like Let's Encrypt's fullchain."""
    key = ec.generate_private_key(ec.SECP256R1())
    now = dt.datetime.now(dt.UTC)
    issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "R12")])

    def cert(cn: str) -> bytes:
        c = (x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)]))
             .issuer_name(issuer).public_key(key.public_key()).serial_number(x509.random_serial_number())
             .not_valid_before(now - dt.timedelta(days=100)).not_valid_after(now + dt.timedelta(days=days))
             .sign(key, hashes.SHA256()))
        return c.public_bytes(serialization.Encoding.PEM)

    settings.letsencrypt_dir.mkdir(parents=True, exist_ok=True)
    (settings.letsencrypt_dir / "server.crt").write_bytes(cert("wifi.example.dev") + cert("R12"))


def test_self_made_certificate_by_default(admin_client):
    body = admin_client.get("/api/certificate").json()
    assert body["name"] == "wifi.test.local" and body["trusted"] is False


def test_lets_encrypt_certificate_is_shown_when_current(admin_client, settings):
    _write_letsencrypt(settings, days=60)
    body = admin_client.get("/api/certificate").json()
    assert (body["name"], body["issuer"], body["trusted"]) == ("wifi.example.dev", "R12", True)
    assert admin_client.get("/api/dashboard").json()["certificate"]["trusted"] is True


def test_expired_or_broken_lets_encrypt_falls_back(admin_client, settings):
    # Same rule as the login server: an expired or unreadable certificate isn't used.
    _write_letsencrypt(settings, days=-1)
    assert admin_client.get("/api/certificate").json()["trusted"] is False
    (settings.letsencrypt_dir / "server.crt").write_text("garbage")
    assert admin_client.get("/api/certificate").json()["name"] == "wifi.test.local"
