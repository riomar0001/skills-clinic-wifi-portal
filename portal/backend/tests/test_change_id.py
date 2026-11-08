import time

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.conftest import PORTAL_HEADERS, person, setup_admin


def test_admin_changes_a_users_id(tmp_path, settings: Settings):
    log = tmp_path / "auth.log"
    log.write_text(f"{int(time.time())}\taccept\t484470\tAA-BB-CC-DD-EE-FF\n")
    s = Settings(**{**vars(settings), "radius_events_file": log})
    with TestClient(create_app(s), headers=PORTAL_HEADERS) as admin:
        setup_admin(admin, s)
        admin.post("/api/wifi-users", json=person("484470"))
        assert len(admin.get("/api/wifi-users/484470/connections").json()) == 1

        r = admin.patch("/api/wifi-users/484470", json={"username": " 484471 "})
        assert r.status_code == 200, r.text
        assert r.json()["username"] == "484471"

        users = s.users_file.read_text()
        assert "484471 NT-Password" in users and "484470 " not in users
        assert admin.get("/api/wifi-users/484470").status_code == 404
        assert len(admin.get("/api/wifi-users/484471/connections").json()) == 1  # history moved along
        entry = admin.get("/api/activity").json()[0]
        assert (entry["action"], entry["target"]) == ("wifi.rename", "484470 to 484471")

        # They sign in (and join the Wi-Fi) with the new ID now.
        with TestClient(admin.app, headers=PORTAL_HEADERS) as me:
            assert me.post("/api/auth/login", json={"username": "484470", "password": "Sunflower-42"}).status_code == 401
            assert me.post("/api/auth/login", json={"username": "484471", "password": "Sunflower-42"}).json()["role"] == "wifi"


def test_change_id_rules(admin_client):
    admin_client.post("/api/wifi-users", json=person("ana"))
    admin_client.post("/api/wifi-users", json=person("ben"))
    assert admin_client.patch("/api/wifi-users/ana", json={"username": "ben"}).status_code == 409
    assert admin_client.patch("/api/wifi-users/ana", json={"username": "a b"}).status_code == 400
    r = admin_client.patch("/api/wifi-users/ana", json={"username": "ANA", "first_name": "Ana"})  # same ID, other edits
    assert r.status_code == 200 and r.json()["username"] == "ana"
    assert admin_client.get("/api/activity").json()[0]["action"] == "wifi.update"


def test_wifi_user_cannot_change_own_id(admin_client):
    admin_client.post("/api/wifi-users", json=person("ana"))
    with TestClient(admin_client.app, headers=PORTAL_HEADERS) as me:
        me.post("/api/auth/login", json={"username": "ana", "password": "Sunflower-42"})
        assert me.patch("/api/me", json={"username": "evil"}).status_code == 422
