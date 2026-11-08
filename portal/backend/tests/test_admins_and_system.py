import hashlib
import socket
import struct
import threading

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.passwords import nt_hash
from app.main import create_app
from app.services.admins import AdminService
from app.services.radius_health import ACCESS_REJECT, RadiusHealthChecker
from tests.conftest import PORTAL_HEADERS, SECRET, person


def test_admin_management(admin_client):
    assert admin_client.delete("/api/admins/boss").status_code == 400  # can't remove yourself
    assert admin_client.post("/api/admins", json={"username": "helper", "password": "short"}).status_code == 400
    assert admin_client.post("/api/admins", json={"username": "helper", "password": "helper-pass-1"}).status_code == 201
    assert [a["username"] for a in admin_client.get("/api/admins").json()] == ["boss", "helper"]
    assert admin_client.delete("/api/admins/helper").status_code == 204
    assert admin_client.delete("/api/admins/nobody").status_code == 404


def test_change_password_signs_out_other_browsers(admin_client, settings):
    with TestClient(admin_client.app, headers=PORTAL_HEADERS) as other:
        assert other.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"}).status_code == 200

        r = admin_client.put("/api/account/password", json={"current_password": "wrong-one-1",
                                                            "new_password": "new-secret-99"})
        assert r.status_code == 400
        r = admin_client.put("/api/account/password", json={"current_password": "correct-horse-1",
                                                            "new_password": "new-secret-99"})
        assert r.status_code == 204
        assert admin_client.get("/api/auth/me").status_code == 200
        assert other.get("/api/auth/me").status_code == 401


def test_admin_password_change_also_sets_their_wifi_password(admin_client, settings):
    admin_client.post("/api/wifi-users", json=person("boss", password="Wifi-Pass-11", email="boss.w@umindanao.edu.ph"))
    with TestClient(admin_client.app, headers=PORTAL_HEADERS) as my_wifi:
        assert my_wifi.post("/api/auth/login", json={"username": "boss", "password": "Wifi-Pass-11"}).json()["role"] == "wifi"

        r = admin_client.put("/api/account/password", json={"current_password": "correct-horse-1",
                                                            "new_password": "Shared-Secret-77"})
        assert r.status_code == 204, r.text

        users = settings.users_file.read_text()
        assert nt_hash("Shared-Secret-77") in users and nt_hash("Wifi-Pass-11") not in users
        assert my_wifi.get("/api/me").status_code == 401  # My Wi-Fi with the old password is signed out
        actions = [a["action"] for a in admin_client.get("/api/activity").json()[:2]]
        assert sorted(actions) == ["admin.password", "wifi.password"]


def test_admin_password_unusable_for_wifi_changes_nothing(admin_client, settings):
    admin_client.post("/api/wifi-users", json=person("boss", password="Wifi-Pass-11", email="boss.w@umindanao.edu.ph"))
    before = settings.users_file.read_text()

    r = admin_client.put("/api/account/password", json={"current_password": "correct-horse-1",
                                                        "new_password": "Contraseña-segura-1"})  # fine for admin only
    assert r.status_code == 400 and "Wi-Fi account" in r.json()["detail"]

    assert settings.users_file.read_text() == before
    with TestClient(admin_client.app, headers=PORTAL_HEADERS) as c:
        assert c.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"}).status_code == 200


def test_admin_without_wifi_account_can_use_any_admin_password(admin_client, settings):
    before = settings.users_file.read_text()
    r = admin_client.put("/api/account/password", json={"current_password": "correct-horse-1",
                                                        "new_password": "Contraseña-segura-1"})
    assert r.status_code == 204, r.text
    assert settings.users_file.read_text() == before


def test_console_reset_also_sets_wifi_password(admin_client, settings):
    admin_client.post("/api/wifi-users", json=person("boss", password="Wifi-Pass-11", email="boss.w@umindanao.edu.ph"))
    app = admin_client.app
    with app.state.session_factory() as db:
        AdminService(db, app.state.exporter).reset_password("boss", "Console-Reset-42")
    assert nt_hash("Console-Reset-42") in settings.users_file.read_text()


def test_certificate_and_downloads(admin_client):
    info = admin_client.get("/api/certificate").json()
    assert info["name"] == "wifi.test.local"
    assert len(info["sha256"].split(":")) == 32
    assert admin_client.get("/api/certificate/ca.der").status_code == 200
    assert admin_client.get("/api/certificate/ca.key").status_code == 422
    assert admin_client.get("/api/certificate/..%2Fclients.conf").status_code in (404, 422)


def test_backup_is_sqlite(admin_client):
    r = admin_client.get("/api/backup")
    assert r.status_code == 200
    assert r.content.startswith(b"SQLite format 3\x00")


def _fake_radius(secret: bytes, sock: socket.socket) -> None:
    data, addr = sock.recvfrom(4096)
    ident, req_auth = data[1], data[4:20]
    header = struct.pack("!BBH", ACCESS_REJECT, ident, 20)
    resp_auth = hashlib.md5(header + req_auth + secret).digest()
    sock.sendto(header + resp_auth, addr)


def test_radius_health_check(settings: Settings):
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as server:
        server.bind(("127.0.0.1", 0))
        port = server.getsockname()[1]
        t = threading.Thread(target=_fake_radius, args=(SECRET.encode(), server), daemon=True)
        t.start()
        s = Settings(**{**vars(settings), "radius_port": port})
        result = RadiusHealthChecker(s).check()
        t.join(timeout=5)
    assert result.ok, result.detail


def test_radius_health_reports_down(settings: Settings):
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as idle:
        idle.bind(("127.0.0.1", 0))  # bound but never answers
        s = Settings(**{**vars(settings), "radius_port": idle.getsockname()[1]})
        result = RadiusHealthChecker(s).check()
    assert not result.ok


def test_dashboard(admin_client):
    admin_client.post("/api/wifi-users", json=person("ana"))
    d = admin_client.get("/api/dashboard").json()
    assert (d["wifi_total"], d["wifi_active"], d["wifi_expired"], d["admins"]) == (1, 1, 0, 1)
    assert d["certificate"]["name"] == "wifi.test.local"
    assert d["recent_activity"][0]["action"] == "wifi.create"
    assert "ok" in d["radius"]


def test_spa_not_served_without_build(settings):
    with TestClient(create_app(settings)) as c:
        assert c.get("/").status_code == 404
