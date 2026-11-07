from fastapi.testclient import TestClient

from app.core.passwords import nt_hash
from app.main import create_app
from tests.conftest import PORTAL_HEADERS, setup_admin


def users_file(settings) -> str:
    return settings.users_file.read_text()


def test_create_update_disable_delete(admin_client, settings):
    r = admin_client.post("/api/wifi-users", json={"username": "ana", "password": "Sunflower-42",
                                                    "full_name": "Ana Cruz", "note": "Front desk"})
    assert r.status_code == 201, r.text
    assert r.json()["enabled"] is True
    assert "nt_hash" not in r.json()
    assert f"ana NT-Password := 0x{nt_hash('Sunflower-42')}" in users_file(settings)

    assert admin_client.post("/api/wifi-users", json={"username": "ana", "password": "Sunflower-42"}).status_code == 409

    r = admin_client.patch("/api/wifi-users/ana", json={"enabled": False})
    assert r.json()["enabled"] is False
    assert "ana " not in users_file(settings)

    admin_client.patch("/api/wifi-users/ana", json={"enabled": True, "full_name": "Ana C."})
    assert admin_client.get("/api/wifi-users/ana").json()["full_name"] == "Ana C."

    assert admin_client.put("/api/wifi-users/ana/password", json={"password": "Daisy-Field-7"}).status_code == 204
    assert nt_hash("Daisy-Field-7") in users_file(settings)
    assert nt_hash("Sunflower-42") not in users_file(settings)

    assert admin_client.delete("/api/wifi-users/ana").status_code == 204
    assert "ana " not in users_file(settings)
    assert admin_client.get("/api/wifi-users/ana").status_code == 404

    actions = [a["action"] for a in admin_client.get("/api/activity").json()]
    assert actions[:5] == ["wifi.delete", "wifi.password", "wifi.enable", "wifi.disable", "wifi.create"]


def test_validation_messages(admin_client):
    r = admin_client.post("/api/wifi-users", json={"username": "Ana", "password": "Sunflower-42"})
    assert r.status_code == 400 and "lowercase" in r.json()["detail"]
    r = admin_client.post("/api/wifi-users", json={"username": "ana", "password": "short"})
    assert r.status_code == 400 and "8-64" in r.json()["detail"]
    r = admin_client.post("/api/wifi-users", json={"username": "ana", "password": "Sunflower-42", "admin": True})
    assert r.status_code == 422
    assert admin_client.get("/api/wifi-users/BAD%20NAME").status_code == 422


def test_search_and_status_filter(admin_client):
    for name, full in (("ana", "Ana Cruz"), ("ben", "Ben Reyes"), ("carla", "Carla Ana")):
        admin_client.post("/api/wifi-users", json={"username": name, "password": "Sunflower-42", "full_name": full})
    admin_client.patch("/api/wifi-users/ben", json={"enabled": False})

    names = lambda r: [u["username"] for u in r.json()]
    assert names(admin_client.get("/api/wifi-users", params={"search": "ana"})) == ["ana", "carla"]
    assert names(admin_client.get("/api/wifi-users", params={"status": "disabled"})) == ["ben"]
    assert names(admin_client.get("/api/wifi-users", params={"search": "%"})) == []


def test_legacy_users_imported_once(settings):
    settings.users_file.write_text("# old\nmario NT-Password := 0x54A62417BB6A4BEB67C8B4A2DC7A6897\n")
    with TestClient(create_app(settings), headers=PORTAL_HEADERS) as c:
        setup_admin(c, settings)
        assert [u["username"] for u in c.get("/api/wifi-users").json()] == ["mario"]
        c.delete("/api/wifi-users/mario")
    with TestClient(create_app(settings), headers=PORTAL_HEADERS) as c:
        c.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"})
        assert c.get("/api/wifi-users").json() == []  # not re-imported after a restart
