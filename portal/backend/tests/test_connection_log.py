import time

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.services.connection_log import parse_line
from tests.conftest import PORTAL_HEADERS, person, setup_admin


def test_parse_line():
    e = parse_line("1794096000\taccept\t484470\taa-bb-cc-dd-ee-ff")
    assert (e.at, e.username, e.accepted, e.device) == (1794096000, "484470", True, "AA-BB-CC-DD-EE-FF")
    assert parse_line("1794096000\treject\tANA\t").username == "ana"
    for bad in ("", "x\taccept\tana\t", "1\tmaybe\tana\t", "1\taccept\tana", "1\taccept\tbad=09name\t",
                "1\taccept\tana\tdev\textra"):
        assert parse_line(bad) is None, bad
    assert parse_line("1\taccept\tana\t<script>").device == ""  # odd device text is dropped, not trusted


def test_history_import_is_incremental_and_survives_truncation(tmp_path, settings: Settings):
    log = tmp_path / "auth.log"
    s = Settings(**{**vars(settings), "radius_events_file": log})
    now = int(time.time())
    log.write_text(f"{now - 60}\treject\t484470\tAA-BB-CC-DD-EE-FF\n{now}\taccept\t484470\tAA-BB-CC-DD-EE-FF\n"
                   f"{now}\taccept\tsomeone\t\n{now}\taccept\t484470\tAA-BB")  # last line is half-written
    with TestClient(create_app(s), headers=PORTAL_HEADERS) as c:
        setup_admin(c, s)
        c.post("/api/wifi-users", json=person("484470"))
        events = c.get("/api/wifi-users/484470/connections").json()
        assert [(e["accepted"], e["device"]) for e in events] == [(True, "AA-BB-CC-DD-EE-FF"), (False, "AA-BB-CC-DD-EE-FF")]

        with log.open("a") as f:
            f.write("-CC-DD-EE-FF\n")  # the half-written line is finished
        assert len(c.get("/api/wifi-users/484470/connections").json()) == 3

        log.write_text(f"{now + 5}\taccept\t484470\t11-22-33-44-55-66\n")  # emptied by the size cap, then written
        events = c.get("/api/wifi-users/484470/connections").json()
        assert len(events) == 4 and events[0]["device"] == "11-22-33-44-55-66"

        # a signed-in Wi-Fi user sees only their own history
        with TestClient(c.app, headers=PORTAL_HEADERS) as me:
            me.post("/api/auth/login", json={"username": "484470", "password": "Sunflower-42"})
            assert len(me.get("/api/me/connections").json()) == 4
            assert me.get("/api/me").json()["last_connected_at"] == now + 5


def test_missing_log_file_is_fine(admin_client):
    admin_client.post("/api/wifi-users", json=person("ana"))
    assert admin_client.get("/api/wifi-users/ana/connections").json() == []
    assert admin_client.get("/api/wifi-users/ghost/connections").status_code == 404
