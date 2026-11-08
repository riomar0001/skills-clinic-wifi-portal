from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.passwords import nt_hash
from app.main import create_app
from tests.conftest import PORTAL_HEADERS, person

URL = "/api/self-service/password"


def _add_ana(admin_client):
    r = admin_client.post("/api/wifi-users", json=person("ana"))
    assert r.status_code == 201


def test_wifi_user_changes_own_password(admin_client, settings):
    _add_ana(admin_client)
    r = admin_client.post(URL, json={"username": "Ana ", "current_password": "Sunflower-42", "new_password": "Daisy-Field-7"})
    assert r.status_code == 204, r.text
    users = settings.users_file.read_text()
    assert nt_hash("Daisy-Field-7") in users and nt_hash("Sunflower-42") not in users
    assert admin_client.get("/api/activity").json()[0]["action"] == "wifi.self_password"


def test_self_service_rejects_wrong_or_disabled(admin_client):
    _add_ana(admin_client)
    wrong = admin_client.post(URL, json={"username": "ana", "current_password": "nope-nope-1", "new_password": "Daisy-Field-7"})
    assert wrong.status_code == 401
    unknown = admin_client.post(URL, json={"username": "ghost", "current_password": "Sunflower-42", "new_password": "Daisy-Field-7"})
    assert unknown.status_code == 401 and unknown.json() == wrong.json()  # same answer: no username probing
    same = admin_client.post(URL, json={"username": "ana", "current_password": "Sunflower-42", "new_password": "Sunflower-42"})
    assert same.status_code == 400
    weak = admin_client.post(URL, json={"username": "ana", "current_password": "Sunflower-42", "new_password": "short"})
    assert weak.status_code == 400

    admin_client.patch("/api/wifi-users/ana", json={"enabled": False})
    disabled = admin_client.post(URL, json={"username": "ana", "current_password": "Sunflower-42", "new_password": "Daisy-Field-7"})
    assert disabled.status_code == 401


def test_self_service_is_throttled(admin_client):
    _add_ana(admin_client)
    for _ in range(5):
        admin_client.post(URL, json={"username": "ana", "current_password": "guess-guess-1", "new_password": "Daisy-Field-7"})
    r = admin_client.post(URL, json={"username": "ana", "current_password": "Sunflower-42", "new_password": "Daisy-Field-7"})
    assert r.status_code == 429


def test_self_service_listener_only_serves_the_password_page(settings: Settings, tmp_path):
    # TestClient requests arrive on port 80, so make 80 the self-service port.
    web = tmp_path / "web"
    (web / "assets").mkdir(parents=True)
    (web / "index.html").write_text("<div id=root></div>")
    (web / "assets" / "app.js").write_text("// js")
    s = Settings(**{**vars(settings), "self_service_port": 80, "static_dir": web})
    with TestClient(create_app(s), headers=PORTAL_HEADERS, follow_redirects=False) as c:
        r = c.get("/")
        assert r.status_code == 307 and r.headers["location"] == "/change-password"
        assert c.get("/change-password").status_code == 200
        assert c.get("/assets/app.js").status_code == 200
        for path in ("/api/auth/status", "/api/wifi-users", "/api/dashboard", "/wifi-users", "/login", "/api/backup"):
            assert c.get(path).status_code == 404, path
        assert c.post("/api/auth/login", json={"username": "x", "password": "y"}).status_code == 404
        assert c.post(URL, json={"username": "ana", "current_password": "x" * 8, "new_password": "y" * 8}).status_code == 401
