from fastapi.testclient import TestClient

from app.core.passwords import nt_hash
from app.main import create_app
from tests.conftest import PORTAL_HEADERS, person, setup_admin


def users_file(settings) -> str:
    return settings.users_file.read_text()


def test_create_update_disable_delete(admin_client, settings):
    r = admin_client.post("/api/wifi-users", json=person("484470", first_name="Mario Jr", last_name="Inguito",
                                                         email="M.Inguito.484470@UMindanao.edu.ph", note="Front desk"))
    assert r.status_code == 201, r.text
    body = r.json()
    assert (body["username"], body["first_name"], body["last_name"]) == ("484470", "Mario Jr", "Inguito")
    assert body["email"] == "m.inguito.484470@umindanao.edu.ph"  # stored in lowercase
    assert body["enabled"] is True and "nt_hash" not in body
    assert f"484470 NT-Password := 0x{nt_hash('Sunflower-42')}" in users_file(settings)

    assert admin_client.post("/api/wifi-users", json=person("484470")).status_code == 409

    r = admin_client.patch("/api/wifi-users/484470", json={"enabled": False})
    assert r.json()["enabled"] is False
    assert "484470 " not in users_file(settings)

    admin_client.patch("/api/wifi-users/484470", json={"enabled": True, "first_name": "Mario"})
    assert admin_client.get("/api/wifi-users/484470").json()["first_name"] == "Mario"

    assert admin_client.put("/api/wifi-users/484470/password", json={"password": "Daisy-Field-7"}).status_code == 204
    assert nt_hash("Daisy-Field-7") in users_file(settings)
    assert nt_hash("Sunflower-42") not in users_file(settings)

    assert admin_client.delete("/api/wifi-users/484470").status_code == 204
    assert "484470 " not in users_file(settings)
    assert admin_client.get("/api/wifi-users/484470").status_code == 404

    actions = [a["action"] for a in admin_client.get("/api/activity").json()]
    assert actions[:5] == ["wifi.delete", "wifi.password", "wifi.enable", "wifi.disable", "wifi.create"]


def test_id_is_lowercased(admin_client):
    r = admin_client.post("/api/wifi-users", json=person("FAC-001", email="fac001@umindanao.edu.ph"))
    assert r.status_code == 201 and r.json()["username"] == "fac-001"


def test_validation_messages(admin_client):
    def error(**changes):
        r = admin_client.post("/api/wifi-users", json={**person("ana"), **changes})
        return r.status_code, r.json()["detail"]

    assert error(username="a b")[0] == 400 and "Student ID / Faculty ID" in error(username="a b")[1]
    assert error(password="short") == (400, "Wi-Fi password must be 8-64 plain keyboard characters (no accents or emoji).")
    assert error(first_name="  ")[1] == "First name is required."
    assert error(last_name="")[1] == "Last name is required."
    for bad in ("ana@gmail.com", "ana@umindanao.edu.ph.evil.com", "@umindanao.edu.ph", "not-an-email"):
        assert error(email=bad) == (400, "Email must be a UMindanao address ending in @umindanao.edu.ph."), bad
    r = admin_client.post("/api/wifi-users", json={**person("ana"), "admin": True})
    assert r.status_code == 422
    r = admin_client.post("/api/wifi-users", json={"username": "ana", "password": "Sunflower-42"})
    assert r.status_code == 422  # names and email are required
    assert admin_client.get("/api/wifi-users/BAD%20NAME").status_code == 422


def test_email_must_be_unique(admin_client):
    shared = "shared@umindanao.edu.ph"
    assert admin_client.post("/api/wifi-users", json=person("ana", email=shared)).status_code == 201
    r = admin_client.post("/api/wifi-users", json=person("ben", email="SHARED@umindanao.edu.ph"))
    assert r.status_code == 409 and "email" in r.json()["detail"]
    assert admin_client.post("/api/wifi-users", json=person("ben")).status_code == 201
    r = admin_client.patch("/api/wifi-users/ben", json={"email": shared})
    assert r.status_code == 409
    assert admin_client.patch("/api/wifi-users/ana", json={"email": shared}).status_code == 200  # own email is fine


def test_search_and_status_filter(admin_client):
    for name, first, last in (("ana", "Ana", "Cruz"), ("ben", "Ben", "Reyes"), ("carla", "Carla", "Anaya")):
        admin_client.post("/api/wifi-users", json=person(name, first_name=first, last_name=last))
    admin_client.patch("/api/wifi-users/ben", json={"enabled": False})

    names = lambda r: [u["username"] for u in r.json()]
    assert names(admin_client.get("/api/wifi-users", params={"search": "ana"})) == ["ana", "carla"]
    assert names(admin_client.get("/api/wifi-users", params={"search": "Ben Reyes"})) == ["ben"]
    assert names(admin_client.get("/api/wifi-users", params={"search": "carla.test@"})) == ["carla"]
    assert names(admin_client.get("/api/wifi-users", params={"status": "disabled"})) == ["ben"]
    assert names(admin_client.get("/api/wifi-users", params={"search": "%"})) == []


def test_legacy_users_imported_once(settings):
    settings.users_file.write_text("# old\nmario NT-Password := 0x54A62417BB6A4BEB67C8B4A2DC7A6897\n")
    with TestClient(create_app(settings), headers=PORTAL_HEADERS) as c:
        setup_admin(c, settings)
        imported = c.get("/api/wifi-users").json()
        assert [u["username"] for u in imported] == ["mario"] and imported[0]["email"] is None
        c.delete("/api/wifi-users/mario")
    with TestClient(create_app(settings), headers=PORTAL_HEADERS) as c:
        c.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"})
        assert c.get("/api/wifi-users").json() == []  # not re-imported after a restart
