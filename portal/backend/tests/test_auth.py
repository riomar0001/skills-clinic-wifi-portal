import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services import auth
from app.services.auth import LoginThrottle
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


def test_session_cookie_is_secure_only_over_https(client, settings):
    setup_admin(client, settings)
    https = TestClient(client.app, headers=PORTAL_HEADERS, base_url="https://testserver")
    r = https.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"})
    assert r.status_code == 200 and "secure" in r.headers["set-cookie"].lower()
    r = client.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"})
    assert r.status_code == 200 and "secure" not in r.headers["set-cookie"].lower()


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


# ----- the wrong-password lock -----

class _Clock:
    """Stands in for the time module inside the auth service, so tests can move time forward."""

    def __init__(self):
        self.now = 1000.0

    def monotonic(self) -> float:
        return self.now


@pytest.fixture
def clock(monkeypatch):
    fake = _Clock()
    monkeypatch.setattr(auth, "time", fake)
    return fake


def _fail(throttle: LoginThrottle, key: str, times: int) -> None:
    for _ in range(times):
        throttle.failed(key)


def test_five_wrong_passwords_lock_that_device_only(clock):
    t = LoginThrottle()
    _fail(t, "boss|1.1.1.1", 4)
    assert t.seconds_locked("boss|1.1.1.1") == 0
    _fail(t, "boss|1.1.1.1", 1)
    assert t.seconds_locked("boss|1.1.1.1") == auth.LOGIN_LOCK_SECONDS
    assert t.seconds_locked("boss|2.2.2.2") == 0  # the real admin elsewhere can still sign in

    clock.now += auth.LOGIN_LOCK_SECONDS
    assert t.seconds_locked("boss|1.1.1.1") == 0


def test_guesses_spread_over_many_addresses_lock_the_account(clock):
    t = LoginThrottle()
    for i in range(auth.ACCOUNT_MAX_FAILURES):
        t.failed(f"boss|10.0.0.{i}")  # one guess per address: no pair is ever locked
    assert t.seconds_locked("boss|10.9.9.9") == auth.ACCOUNT_LOCK_SECONDS
    assert t.seconds_locked("other|10.9.9.9") == 0


def test_old_failures_are_forgotten(clock):
    t = LoginThrottle()
    _fail(t, "boss|1.1.1.1", 4)
    clock.now += auth.LOGIN_WINDOW_SECONDS
    _fail(t, "boss|1.1.1.1", 1)
    assert t.seconds_locked("boss|1.1.1.1") == 0


def test_a_correct_password_clears_the_count(clock):
    t = LoginThrottle()
    _fail(t, "boss|1.1.1.1", 4)
    t.succeeded("boss|1.1.1.1")
    _fail(t, "boss|1.1.1.1", 4)
    assert t.seconds_locked("boss|1.1.1.1") == 0


def test_flooding_made_up_names_cannot_clear_a_lock(clock, monkeypatch):
    monkeypatch.setattr(auth, "MAX_TRACKED_KEYS", 10)
    t = LoginThrottle()
    _fail(t, "boss|6.6.6.6", 5)
    for i in range(500):
        t.failed(f"junk{i}|6.6.6.6")
    assert t.seconds_locked("boss|6.6.6.6") > 0


def test_a_table_full_of_locks_refuses_new_names(clock, monkeypatch):
    monkeypatch.setattr(auth, "MAX_TRACKED_KEYS", 2)
    t = LoginThrottle()
    _fail(t, "a|6.6.6.6", 5)
    _fail(t, "b|6.6.6.6", 5)
    assert t.seconds_locked("c|6.6.6.6") == auth.SATURATED_WAIT_SECONDS  # fails closed under attack

    clock.now += auth.LOGIN_WINDOW_SECONDS
    assert t.seconds_locked("c|6.6.6.6") == 0  # finished entries make room again


def test_sign_in_uses_the_account_lock(client, settings):
    setup_admin(client, settings)
    throttle = client.app.state.throttle
    for i in range(auth.ACCOUNT_MAX_FAILURES):
        throttle.failed(f"boss|10.0.0.{i}")
    with TestClient(client.app, headers=PORTAL_HEADERS) as other:
        r = other.post("/api/auth/login", json={"username": "boss", "password": "correct-horse-1"})
        assert r.status_code == 429
