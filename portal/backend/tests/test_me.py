import time

from fastapi.testclient import TestClient
from sqlalchemy import update

from app.core.passwords import nt_hash
from app.db.models import WifiUser
from tests.conftest import PORTAL_HEADERS, person


def _wifi_client(admin_client, username="484470", password="Sunflower-42"):
    """Adds a Wi-Fi user (as admin), then signs in as them in a separate browser."""
    r = admin_client.post("/api/wifi-users", json=person(username, password=password, first_name="Mario Jr",
                                                         last_name="Inguito"))
    assert r.status_code == 201, r.text
    c = TestClient(admin_client.app, headers=PORTAL_HEADERS)
    r = c.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return c


def test_wifi_user_signs_in_on_the_shared_page(admin_client):
    with _wifi_client(admin_client) as me:
        status = me.get("/api/auth/status").json()
        assert status == {"needs_setup": False, "role": "wifi", "username": "484470", "name": "Mario Jr Inguito"}
        profile = me.get("/api/me").json()
        assert (profile["username"], profile["first_name"], profile["expired"]) == ("484470", "Mario Jr", False)
        assert "nt_hash" not in profile


def test_wifi_session_never_reaches_admin_api(admin_client):
    with _wifi_client(admin_client) as me:
        for path in ("/api/wifi-users", "/api/admins", "/api/dashboard", "/api/backup", "/api/auth/me"):
            assert me.get(path).status_code == 401, path
        assert me.post("/api/router-secret", json={"password": "Sunflower-42"}).status_code == 401
    # and an admin session isn't a Wi-Fi user session
    assert admin_client.get("/api/me").status_code == 401


def test_wrong_password_and_disabled_user(admin_client):
    admin_client.post("/api/wifi-users", json=person("ana"))
    with TestClient(admin_client.app, headers=PORTAL_HEADERS) as c:
        assert c.post("/api/auth/login", json={"username": "ana", "password": "nope-nope-1"}).status_code == 401
        admin_client.patch("/api/wifi-users/ana", json={"enabled": False})
        assert c.post("/api/auth/login", json={"username": "ana", "password": "Sunflower-42"}).status_code == 401


def test_disabling_ends_an_open_session(admin_client):
    with _wifi_client(admin_client) as me:
        assert me.get("/api/me").status_code == 200
        admin_client.patch("/api/wifi-users/484470", json={"enabled": False})
        assert me.get("/api/me").status_code == 401


def test_update_own_details(admin_client):
    with _wifi_client(admin_client) as me:
        r = me.patch("/api/me", json={"first_name": "Mario", "email": "MARIO@umindanao.edu.ph"})
        assert r.status_code == 200, r.text
        assert (r.json()["first_name"], r.json()["email"]) == ("Mario", "mario@umindanao.edu.ph")
        assert me.patch("/api/me", json={"email": "mario@gmail.com"}).status_code == 400
        # admin-only fields aren't accepted
        assert me.patch("/api/me", json={"enabled": False}).status_code == 422
        assert me.patch("/api/me", json={"expires_at": None}).status_code == 422


def test_change_own_password(admin_client, settings):
    with _wifi_client(admin_client) as me, TestClient(admin_client.app, headers=PORTAL_HEADERS) as other:
        other.post("/api/auth/login", json={"username": "484470", "password": "Sunflower-42"})

        r = me.put("/api/me/password", json={"current_password": "wrong-pass-1", "new_password": "Garden-Path-58"})
        assert r.status_code == 400  # wrong current password: 400 so the browser stays signed in
        r = me.put("/api/me/password", json={"current_password": "Sunflower-42", "new_password": "Garden-Path-58"})
        assert r.status_code == 204, r.text

        assert nt_hash("Garden-Path-58") in settings.users_file.read_text()
        assert me.get("/api/me").status_code == 200       # this browser stays signed in
        assert other.get("/api/me").status_code == 401    # the other one is signed out
        assert admin_client.get("/api/activity").json()[0]["action"] == "wifi.self_password"


def test_expired_user_can_sign_in_but_not_change_password(admin_client):
    with _wifi_client(admin_client) as me:
        with admin_client.app.state.session_factory() as db:
            db.execute(update(WifiUser).values(expires_at=int(time.time()) - 60))
            db.commit()
        assert me.get("/api/me").json()["expired"] is True
        r = me.put("/api/me/password", json={"current_password": "Sunflower-42", "new_password": "Garden-Path-58"})
        assert r.status_code == 400 and "expired" in r.json()["detail"]


def test_admin_wins_when_names_collide(admin_client):
    # A Wi-Fi user with the admin's username and a different password signs in as the Wi-Fi user.
    admin_client.post("/api/wifi-users", json=person("boss", password="Wifi-Pass-11", email="boss.w@umindanao.edu.ph"))
    with TestClient(admin_client.app, headers=PORTAL_HEADERS) as c:
        assert c.post("/api/auth/login", json={"username": "boss", "password": "Wifi-Pass-11"}).json()["role"] == "wifi"
        assert c.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"}).json()["role"] == "admin"
