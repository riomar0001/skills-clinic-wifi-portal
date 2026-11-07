import time

from sqlalchemy import update

from app.db.models import WifiUser
from app.services.radius_export import radius_expiration, users_line

DAY = 86400


def _expire_now(client, username: str) -> None:
    """The API refuses past expiry dates, so move one into the past directly in the database."""
    with client.app.state.session_factory() as db:
        db.execute(update(WifiUser).where(WifiUser.username == username).values(expires_at=int(time.time()) - 60))
        db.commit()


def test_radius_line_format():
    assert radius_expiration(0) == "Jan 01 1970 00:00:00"
    assert users_line("ana", "AB" * 16, None) == f"ana NT-Password := 0x{'AB' * 16}"
    assert users_line("ana", "AB" * 16, 86400).endswith(', Expiration := "Jan 02 1970 00:00:00"')


def test_create_with_expiry_and_clear_it(admin_client, settings):
    expires = int(time.time()) + 7 * DAY
    r = admin_client.post("/api/wifi-users", json={"username": "guest1", "password": "Sunflower-42", "expires_at": expires})
    assert r.status_code == 201, r.text
    assert r.json()["expires_at"] == expires and r.json()["expired"] is False
    assert f'Expiration := "{radius_expiration(expires)}"' in settings.users_file.read_text()

    r = admin_client.patch("/api/wifi-users/guest1", json={"full_name": "Guest"})  # expiry not sent: kept
    assert r.json()["expires_at"] == expires

    r = admin_client.patch("/api/wifi-users/guest1", json={"expires_at": None})
    assert r.json()["expires_at"] is None
    assert "Expiration" not in settings.users_file.read_text()
    assert admin_client.get("/api/activity").json()[0]["action"] == "wifi.expiry_clear"


def test_expiry_validation(admin_client):
    now = int(time.time())
    base = {"username": "guest2", "password": "Sunflower-42"}
    assert admin_client.post("/api/wifi-users", json={**base, "expires_at": now - 10}).status_code == 400
    assert admin_client.post("/api/wifi-users", json={**base, "expires_at": now + 11 * 365 * DAY}).status_code == 400
    assert admin_client.post("/api/wifi-users", json={**base, "expires_at": str(now + DAY)}).status_code == 422


def test_expired_users_are_listed_counted_and_locked_out(admin_client):
    for name in ("ana", "ben"):
        admin_client.post("/api/wifi-users", json={"username": name, "password": "Sunflower-42"})
    _expire_now(admin_client, "ben")

    names = lambda status: [u["username"] for u in admin_client.get("/api/wifi-users", params={"status": status}).json()]
    assert names("active") == ["ana"]
    assert names("expired") == ["ben"]
    assert admin_client.get("/api/wifi-users/ben").json()["expired"] is True

    d = admin_client.get("/api/dashboard").json()
    assert (d["wifi_total"], d["wifi_active"], d["wifi_expired"]) == (2, 1, 1)

    r = admin_client.post("/api/self-service/password",
                          json={"username": "ben", "current_password": "Sunflower-42", "new_password": "Daisy-Field-7"})
    assert r.status_code == 401

    # Extending the expiry brings them back.
    r = admin_client.patch("/api/wifi-users/ben", json={"expires_at": int(time.time()) + DAY})
    assert r.json()["expired"] is False
    assert names("active") == ["ana", "ben"]
