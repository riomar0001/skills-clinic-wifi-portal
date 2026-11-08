from tests.conftest import SECRET

URL = "/api/router-secret"


def test_needs_password_even_when_signed_in(admin_client):
    r = admin_client.post(URL, json={"password": "not-my-password"})
    assert r.status_code == 401
    r = admin_client.post(URL, json={"password": "correct-horse-1"})
    assert r.status_code == 200
    assert r.json()["secret"] == SECRET
    assert "client router" in r.json()["clients_conf"]
    assert r.headers["Cache-Control"] == "no-store"
    assert admin_client.get("/api/activity").json()[0]["action"] == "admin.reveal_secret"


def test_requires_sign_in(client):
    assert client.post(URL, json={"password": "x"}).status_code == 401


def test_wrong_passwords_lock_it(admin_client):
    for _ in range(5):
        admin_client.post(URL, json={"password": "guess-guess-1"})
    assert admin_client.post(URL, json={"password": "correct-horse-1"}).status_code == 429


def test_get_is_not_allowed(admin_client):
    # Only POST with the password; nothing to fetch with a plain link.
    assert admin_client.get(URL).status_code == 405
