import datetime as dt
from pathlib import Path

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app

PORTAL_HEADERS = {"X-Requested-With": "wifi-portal"}
SECRET = "test-secret-123"


def _write_cert(certs: Path) -> None:
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "wifi.test.local")])
    now = dt.datetime.now(dt.UTC)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(1).not_valid_before(now).not_valid_after(now + dt.timedelta(days=30))
            .sign(key, hashes.SHA256()))
    pem = cert.public_bytes(serialization.Encoding.PEM)
    # Like openssl's output: a text dump before the PEM block.
    (certs / "server.crt").write_bytes(b"Certificate:\n    Data: ...\n" + pem)
    (certs / "server.pem").write_text("PRIVATE KEY + cert - the portal must not need this")
    (certs / "ca.pem").write_bytes(pem)
    (certs / "ca.der").write_bytes(cert.public_bytes(serialization.Encoding.DER))
    (certs / "ca.key").write_text("PRIVATE - must never be served")


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    radius = tmp_path / "radius"
    (radius / "certs").mkdir(parents=True)
    (radius / "clients.conf").write_text(f"client router {{\n\tsecret = {SECRET}\n}}\n")
    _write_cert(radius / "certs")
    return Settings(db_path=tmp_path / "db" / "portal.db", radius_dir=radius, static_dir=None,
                    radius_host="127.0.0.1", radius_port=9)


@pytest.fixture
def client(settings: Settings):
    with TestClient(create_app(settings), headers=PORTAL_HEADERS) as c:
        yield c


def person(username: str, password: str = "Sunflower-42", **extra) -> dict:
    """A complete Wi-Fi user payload (ID, names, UMindanao email); override any field with extra."""
    return {"username": username, "password": password, "first_name": "Test", "last_name": username.title(),
            "email": f"{username}.test@umindanao.edu.ph", **extra}


def setup_admin(client: TestClient, settings: Settings, username="boss", password="correct-horse-1"):
    code = settings.setup_code_file.read_text().strip()
    r = client.post("/api/auth/setup", json={"setup_code": code, "username": username, "password": password})
    assert r.status_code == 200, r.text
    return r


@pytest.fixture
def admin_client(client: TestClient, settings: Settings):
    setup_admin(client, settings)
    return client
