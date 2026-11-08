import hashlib
import socket
import struct
import threading
import time

from fastapi.testclient import TestClient
from sqlalchemy import update

from app.core.config import Settings
from app.core.passwords import nt_hash
from app.db.models import WifiUser
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


def _login(app, username, password):
    with TestClient(app, headers=PORTAL_HEADERS) as c:
        return c.post("/api/auth/login", json={"username": username, "password": password})


def test_promoted_wifi_user_signs_in_as_admin_with_their_wifi_password(admin_client, settings):
    admin_client.post("/api/wifi-users", json=person("484470", password="Wifi-Pass"))  # 9 chars: fine
    users_before = settings.users_file.read_text()

    r = admin_client.post("/api/wifi-users/484470/promote")
    assert r.status_code == 201, r.text
    assert r.json()["uses_wifi_password"] is True
    assert admin_client.post("/api/wifi-users/484470/promote").status_code == 409
    assert admin_client.get("/api/activity").json()[0]["action"] == "admin.promote"

    assert settings.users_file.read_text() == users_before  # their devices keep working
    assert _login(admin_client.app, "484470", "Wifi-Pass").json()["role"] == "admin"
    assert _login(admin_client.app, "484470", "wrong-pass-1").status_code == 401


def test_promote_refuses_unknown_or_inactive_wifi_users(admin_client):
    assert admin_client.post("/api/wifi-users/nobody/promote").status_code == 404
    admin_client.post("/api/wifi-users", json=person("484470"))
    admin_client.patch("/api/wifi-users/484470", json={"enabled": False})
    r = admin_client.post("/api/wifi-users/484470/promote")
    assert r.status_code == 400 and "off or expired" in r.json()["detail"]


def test_promoted_admin_loses_admin_sign_in_with_their_wifi_access(admin_client):
    admin_client.post("/api/wifi-users", json=person("484470", password="Wifi-Pass-11"))
    admin_client.post("/api/wifi-users/484470/promote")

    admin_client.patch("/api/wifi-users/484470", json={"enabled": False})
    assert _login(admin_client.app, "484470", "Wifi-Pass-11").status_code == 401  # fails closed
    admin_client.patch("/api/wifi-users/484470", json={"enabled": True})
    assert _login(admin_client.app, "484470", "Wifi-Pass-11").json()["role"] == "admin"

    with admin_client.app.state.session_factory() as db:
        db.execute(update(WifiUser).values(expires_at=int(time.time()) - 60))
        db.commit()
    # Expired: still allowed into My Wi-Fi (to see why), but no longer into the admin portal.
    assert _login(admin_client.app, "484470", "Wifi-Pass-11").json()["role"] == "wifi"

    admin_client.delete("/api/wifi-users/484470")
    assert _login(admin_client.app, "484470", "Wifi-Pass-11").status_code == 401


def test_promoted_admin_password_change_stays_one_password(admin_client, settings):
    admin_client.post("/api/wifi-users", json=person("484470", password="Wifi-Pass-11"))
    admin_client.post("/api/wifi-users/484470/promote")
    with TestClient(admin_client.app, headers=PORTAL_HEADERS) as me:
        assert me.post("/api/auth/login", json={"username": "484470", "password": "Wifi-Pass-11"}).status_code == 200
        r = me.post("/api/router-secret", json={"password": "Wifi-Pass-11"})
        assert r.status_code == 200, r.text  # re-entering the password works too
        r = me.put("/api/account/password", json={"current_password": "Wifi-Pass-11", "new_password": "Next-Pass-2024"})
        assert r.status_code == 204, r.text

    assert nt_hash("Next-Pass-2024") in settings.users_file.read_text()
    assert _login(admin_client.app, "484470", "Next-Pass-2024").json()["role"] == "admin"
    # An admin resetting their Wi-Fi password resets their admin sign-in too: it's one password.
    admin_client.put("/api/wifi-users/484470/password", json={"password": "Reset-Pass-77"})
    assert _login(admin_client.app, "484470", "Reset-Pass-77").json()["role"] == "admin"
    assert _login(admin_client.app, "484470", "Next-Pass-2024").status_code == 401


def test_console_reset_gives_an_orphaned_promoted_admin_its_own_password(admin_client):
    admin_client.post("/api/wifi-users", json=person("484470", password="Wifi-Pass-11"))
    admin_client.post("/api/wifi-users/484470/promote")
    admin_client.delete("/api/wifi-users/484470")
    app = admin_client.app
    with app.state.session_factory() as db:
        AdminService(db, app.state.exporter).reset_password("484470", "Console-Reset-42")
    assert _login(app, "484470", "Console-Reset-42").json()["role"] == "admin"


def test_certificate_and_downloads(admin_client):
    info = admin_client.get("/api/certificate").json()
    assert info["name"] == "wifi.test.local"
    assert len(info["sha256"].split(":")) == 32
    assert admin_client.get("/api/certificate/ca.der").status_code == 200
    assert admin_client.get("/api/certificate/ca.key").status_code == 422
    assert admin_client.get("/api/certificate/..%2Fclients.conf").status_code in (404, 422)


def test_backup_asks_for_the_password_again(admin_client):
    assert admin_client.get("/api/backup").status_code == 405  # no one-click download any more
    r = admin_client.post("/api/backup", json={"password": "wrong-horse-1"})
    assert r.status_code == 401 and r.json()["detail"] == "Your password is wrong."
    assert admin_client.get("/api/auth/me").status_code == 200  # a wrong password doesn't sign them out

    r = admin_client.post("/api/backup", json={"password": "correct-horse-1"})
    assert r.status_code == 200
    assert r.content.startswith(b"SQLite format 3\x00")
    assert "attachment" in r.headers["content-disposition"]
    assert admin_client.get("/api/activity").json()[0]["action"] == "admin.backup"


def test_backup_wrong_passwords_count_toward_the_lock(admin_client):
    for _ in range(5):
        admin_client.post("/api/backup", json={"password": "wrong-horse-1"})
    r = admin_client.post("/api/backup", json={"password": "correct-horse-1"})
    assert r.status_code == 429


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
