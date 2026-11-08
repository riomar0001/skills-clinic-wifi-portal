from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import PORTAL_HEADERS, setup_admin


def test_first_run_needs_setup_code(client, settings):
    assert client.get("/api/auth/status").json() == {"needs_setup": True, "role": None, "username": None, "name": None}
    assert settings.setup_code_file.exists()

    r = client.post("/api/auth/setup", json={"setup_code": "WRONG", "username": "boss",
                                              "password": "correct-horse-1"})
    assert r.status_code == 403

    setup_admin(client, settings)
    assert client.get("/api/auth/status").json() == {"needs_setup": False, "role": "admin", "username": "boss", "name": "boss"}
    assert not settings.setup_code_file.exists()

    r = client.post("/api/auth/setup", json={"setup_code": "x", "username": "evil", "password": "correct-horse-2"})
    assert r.status_code == 409


def test_login_logout_and_throttle(client, settings):
    setup_admin(client, settings)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/wifi-users").status_code == 401

    for _ in range(5):
        r = client.post("/api/auth/login", json={"username": "boss", "password": "nope-nope-nope"})
        assert r.status_code == 401
    r = client.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"})
    assert r.status_code == 429  # locked even with the right password

    # The lock is per address: the real admin on another computer can still sign in.
    other = TestClient(client.app, headers=PORTAL_HEADERS, client=("192.168.0.50", 50000))
    assert other.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"}).status_code == 200

    client.app.state.throttle.succeeded("boss|testclient")
    r = client.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"})
    assert r.status_code == 200
    assert client.get("/api/wifi-users").status_code == 200


def test_sessions_survive_restart(settings):
    with TestClient(create_app(settings), headers=PORTAL_HEADERS) as c:
        setup_admin(c, settings)
        cookie = c.cookies.get("portal_session")
    with TestClient(create_app(settings), headers=PORTAL_HEADERS) as c:
        c.cookies.set("portal_session", cookie)
        assert c.get("/api/auth/me").status_code == 200


def test_cross_site_and_header_guards(admin_client):
    no_header = admin_client.post("/api/wifi-users", json={}, headers={"X-Requested-With": ""})
    assert no_header.status_code == 403
    cross = admin_client.post("/api/wifi-users", json={}, headers={"Origin": "http://evil.example"})
    assert cross.status_code == 403
    fetch_site = admin_client.post("/api/wifi-users", json={}, headers={"Sec-Fetch-Site": "cross-site"})
    assert fetch_site.status_code == 403
    big = admin_client.post("/api/wifi-users", content=b"x" * 20000,
                            headers={"Content-Type": "application/json"})
    assert big.status_code == 413
    r = admin_client.get("/api/auth/me")
    assert r.headers["X-Frame-Options"] == "DENY"
    csp = r.headers["Content-Security-Policy"]
    assert "default-src 'self'" in csp and "script-src 'self';" in csp
