import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.services.connection_log import normalize_mac
from app.services.radius_export import users_line
from tests.conftest import PORTAL_HEADERS, person, setup_admin

PHONE, LAPTOP, TABLET = "AA-BB-CC-DD-EE-01", "AA-BB-CC-DD-EE-02", "AA-BB-CC-DD-EE-03"


def _client(tmp_path: Path, settings: Settings) -> tuple[TestClient, Path]:
    log = tmp_path / "auth.log"
    log.write_text("")
    s = Settings(**{**vars(settings), "radius_events_file": log})
    return TestClient(create_app(s), headers=PORTAL_HEADERS), log


def _login(log: Path, username: str, mac: str, accepted: bool = True) -> None:
    with log.open("a") as f:
        f.write(f"{int(time.time())}\t{'accept' if accepted else 'reject'}\t{username}\t{mac}\n")


def _users_line(settings: Settings, username: str) -> str:
    return next(line for line in settings.users_file.read_text().splitlines() if line.startswith(f"{username} "))


def test_normalize_mac():
    assert normalize_mac("aa:bb:cc:dd:ee:ff") == "AA-BB-CC-DD-EE-FF"
    assert normalize_mac("AABB.CCDD.EEFF") == "AA-BB-CC-DD-EE-FF"
    for bad in ("", "AA-BB-CC-DD-EE", "zz-bb-cc-dd-ee-ff", 'AA-BB-CC-DD-EE-FF"|.*'):
        assert normalize_mac(bad) == ""


def test_users_line_refuses_anything_that_could_inject_config():
    nt = "A" * 32
    assert users_line("ana", nt, None, [PHONE]) == f'ana Calling-Station-Id =~ "^({PHONE})$", NT-Password := 0x{nt}'
    for bad in ([], ['.*'], [f'{PHONE}" , Auth-Type := Accept']):
        with pytest.raises(ValueError):
            users_line("ana", nt, None, bad)
    with pytest.raises(ValueError):
        users_line('ana", Auth-Type := Accept', nt, None)
    with pytest.raises(ValueError):
        users_line("ana", "not-a-hash", None)


def test_limit_registers_devices_then_restricts(tmp_path, settings):
    c, log = _client(tmp_path, settings)
    with c:
        setup_admin(c, settings)
        r = c.post("/api/wifi-users", json=person("ana", device_limit=2))
        assert r.status_code == 201 and r.json()["device_limit"] == 2

        _login(log, "ana", PHONE)
        assert [d["mac"] for d in c.get("/api/wifi-users/ana/devices").json()] == [PHONE]
        assert "Calling-Station-Id" not in _users_line(settings, "ana")  # one slot still free: any device may join

        _login(log, "ana", "aa:bb:cc:dd:ee:02")  # any MAC format is normalised
        assert [d["mac"] for d in c.get("/api/wifi-users/ana/devices").json()] == [PHONE, LAPTOP]
        assert f'Calling-Station-Id =~ "^({PHONE}|{LAPTOP})$"' in _users_line(settings, "ana")  # limit reached
        assert c.get("/api/wifi-users/ana").json()["device_count"] == 2

        _login(log, "ana", TABLET, accepted=False)  # refused devices are never registered
        assert len(c.get("/api/wifi-users/ana/devices").json()) == 2

        # Freeing a slot lifts the restriction until a new device takes it.
        phone_id = c.get("/api/wifi-users/ana/devices").json()[0]["id"]
        assert c.delete(f"/api/wifi-users/ana/devices/{phone_id}").status_code == 204
        assert "Calling-Station-Id" not in _users_line(settings, "ana")
        assert c.get("/api/activity").json()[0]["action"] == "wifi.device_remove"


def test_changing_the_limit(tmp_path, settings):
    c, log = _client(tmp_path, settings)
    with c:
        setup_admin(c, settings)
        c.post("/api/wifi-users", json=person("ben"))  # no limit by default
        _login(log, "ben", PHONE)
        _login(log, "ben", LAPTOP)
        assert len(c.get("/api/wifi-users/ben/devices").json()) == 2  # reading devices imports new logins
        assert c.get("/api/wifi-users/ben").json()["device_count"] == 2
        assert "Calling-Station-Id" not in _users_line(settings, "ben")

        assert c.patch("/api/wifi-users/ben", json={"device_limit": 1}).json()["device_limit"] == 1
        # Over the limit: both registered devices keep working, new ones are refused.
        assert f'"^({PHONE}|{LAPTOP})$"' in _users_line(settings, "ben")
        assert c.patch("/api/wifi-users/ben", json={"first_name": "Ben"}).json()["device_limit"] == 1  # kept
        assert c.patch("/api/wifi-users/ben", json={"device_limit": None}).json()["device_limit"] is None
        assert "Calling-Station-Id" not in _users_line(settings, "ben")
        for bad in (0, 21, "2", 1.5):
            assert c.patch("/api/wifi-users/ben", json={"device_limit": bad}).status_code == 422, bad


def test_device_endpoints_are_scoped(tmp_path, settings):
    c, log = _client(tmp_path, settings)
    with c:
        setup_admin(c, settings)
        c.post("/api/wifi-users", json=person("ana"))
        c.post("/api/wifi-users", json=person("ben"))
        _login(log, "ana", PHONE)
        ana_device = c.get("/api/wifi-users/ana/devices").json()[0]["id"]
        assert c.delete(f"/api/wifi-users/ben/devices/{ana_device}").status_code == 404  # not ben's
        assert c.get("/api/wifi-users/ana/devices").json()[0]["id"] == ana_device

        with TestClient(c.app, headers=PORTAL_HEADERS) as me:
            me.post("/api/auth/login", json={"username": "ana", "password": "Sunflower-42"})
            assert [d["mac"] for d in me.get("/api/me").json()["devices"]] == [PHONE]
            assert me.delete(f"/api/wifi-users/ana/devices/{ana_device}").status_code == 401  # admins only


def test_admin_password_reset_signs_the_user_out(admin_client):
    admin_client.post("/api/wifi-users", json=person("ana"))
    with TestClient(admin_client.app, headers=PORTAL_HEADERS) as me:
        me.post("/api/auth/login", json={"username": "ana", "password": "Sunflower-42"})
        assert me.get("/api/me").status_code == 200
        admin_client.put("/api/wifi-users/ana/password", json={"password": "Daisy-Field-7"})
        assert me.get("/api/me").status_code == 401
