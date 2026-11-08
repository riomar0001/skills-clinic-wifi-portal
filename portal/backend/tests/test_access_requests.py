import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.core.passwords import nt_hash
from app.db.models import AccessRequest
from app.services import access_requests
from app.services.access_requests import RequestRateLimit
from tests.conftest import PORTAL_HEADERS, person

ASK = {"username": "123456", "password": "Garden-Path-58", "first_name": "Juan", "last_name": "Dela Cruz",
       "email": "j.delacruz.123456@umindanao.edu.ph"}


def _visitor(app) -> TestClient:
    """Someone on the sign-in page: no session."""
    return TestClient(app, headers=PORTAL_HEADERS)


def _ask(app, **changes):
    with _visitor(app) as v:
        return v.post("/api/access-requests", json={**ASK, **changes})


def _only_request(admin_client) -> dict:
    pending = admin_client.get("/api/access-requests").json()
    assert len(pending) == 1
    return pending[0]


def test_request_waits_for_an_admin(admin_client, settings):
    r = _ask(admin_client.app, username="  123456 ")
    assert r.status_code == 201, r.text
    assert r.json() == {"username": "123456"}

    request = _only_request(admin_client)
    assert (request["username"], request["first_name"], request["email"]) == ("123456", "Juan", ASK["email"])
    assert "nt_hash" not in request and "password" not in request
    assert nt_hash(ASK["password"]) not in settings.users_file.read_text()  # no Wi-Fi access yet
    assert admin_client.get("/api/dashboard").json()["access_requests"] == 1

    with _visitor(admin_client.app) as v:
        r = v.post("/api/auth/login", json={"username": "123456", "password": ASK["password"]})
        assert r.status_code == 403 and "waiting for an admin" in r.json()["detail"]
        r = v.post("/api/auth/login", json={"username": "123456", "password": "Not-The-One-1"})
        assert r.status_code == 401  # a wrong password doesn't reveal the request


def test_approve_creates_the_account_with_the_chosen_password(admin_client, settings):
    _ask(admin_client.app)
    request_id = _only_request(admin_client)["id"]
    expires = int(time.time()) + 7 * 24 * 3600

    r = admin_client.post(f"/api/access-requests/{request_id}/approve", json={"expires_at": expires, "device_limit": 1})
    assert r.status_code == 201, r.text
    user = r.json()
    assert (user["username"], user["expires_at"], user["device_limit"]) == ("123456", expires, 1)
    assert user["note"] == access_requests.APPROVED_NOTE

    assert nt_hash(ASK["password"]) in settings.users_file.read_text()
    assert admin_client.get("/api/access-requests").json() == []
    actions = [a["action"] for a in admin_client.get("/api/activity").json()[:2]]
    assert sorted(actions) == ["request.approve", "wifi.create"]
    with _visitor(admin_client.app) as v:
        r = v.post("/api/auth/login", json={"username": "123456", "password": ASK["password"]})
        assert r.json()["role"] == "wifi"


def test_reject_removes_the_request(admin_client):
    _ask(admin_client.app)
    request_id = _only_request(admin_client)["id"]

    assert admin_client.delete(f"/api/access-requests/{request_id}").status_code == 204
    assert admin_client.get("/api/access-requests").json() == []
    assert admin_client.get("/api/activity").json()[0]["action"] == "request.reject"
    assert admin_client.delete(f"/api/access-requests/{request_id}").status_code == 404
    with _visitor(admin_client.app) as v:
        assert v.post("/api/auth/login", json={"username": "123456", "password": ASK["password"]}).status_code == 401


@pytest.mark.parametrize(("changes", "status"), [
    ({"email": "juan@gmail.com"}, 400),
    ({"password": "short"}, 400),
    ({"password": "Contraseña-segura-1"}, 400),  # not usable for Wi-Fi
    ({"username": "Bad ID!"}, 400),
    ({"first_name": ""}, 400),
    ({"role": "admin"}, 422),  # unknown fields are refused
])
def test_bad_requests_are_refused(admin_client, changes, status):
    r = _ask(admin_client.app, **changes)
    assert r.status_code == status, r.text
    assert admin_client.get("/api/access-requests").json() == []


def test_duplicates_are_refused(admin_client):
    admin_client.post("/api/wifi-users", json=person("484470"))
    assert _ask(admin_client.app, username="484470").status_code == 409  # already has access
    assert _ask(admin_client.app, email="484470.test@umindanao.edu.ph").status_code == 409  # email taken

    assert _ask(admin_client.app).status_code == 201
    assert _ask(admin_client.app, email="other.123456@umindanao.edu.ph").status_code == 409  # same ID waiting
    assert _ask(admin_client.app, username="654321").status_code == 409  # same email waiting


def test_approve_fails_cleanly_if_the_id_was_taken_meanwhile(admin_client):
    _ask(admin_client.app)
    request_id = _only_request(admin_client)["id"]
    admin_client.post("/api/wifi-users", json=person("123456", email="someone.else@umindanao.edu.ph"))

    r = admin_client.post(f"/api/access-requests/{request_id}/approve", json={})
    assert r.status_code == 409
    assert _only_request(admin_client)["id"] == request_id  # kept, so the admin can reject it


def test_only_admins_can_review(admin_client):
    _ask(admin_client.app)
    request_id = _only_request(admin_client)["id"]
    with _visitor(admin_client.app) as v:
        assert v.get("/api/access-requests").status_code == 401
        assert v.post(f"/api/access-requests/{request_id}/approve", json={}).status_code == 401
        assert v.delete(f"/api/access-requests/{request_id}").status_code == 401
    with TestClient(admin_client.app) as no_header:
        assert no_header.post("/api/access-requests", json=ASK).status_code == 403  # cross-site guard


def test_waiting_requests_are_capped(admin_client, monkeypatch):
    monkeypatch.setattr(access_requests, "MAX_PENDING", 1)
    assert _ask(admin_client.app).status_code == 201
    r = _ask(admin_client.app, username="654321", email="other.654321@umindanao.edu.ph")
    assert r.status_code == 429


def test_old_requests_are_dropped(admin_client):
    _ask(admin_client.app)
    with admin_client.app.state.session_factory() as db:
        db.execute(update(AccessRequest).values(created_at=int(time.time()) - access_requests.REQUEST_KEEP_SECONDS - 60))
        db.commit()
    assert admin_client.get("/api/access-requests").json() == []


def test_too_many_requests_from_one_address(admin_client):
    admin_client.app.state.request_limit = RequestRateLimit(limit=1)
    assert _ask(admin_client.app).status_code == 201
    r = _ask(admin_client.app, username="654321", email="other.654321@umindanao.edu.ph")
    assert r.status_code == 429 and "Too many requests" in r.json()["detail"]


def test_rate_limit_counts_each_address_separately():
    limit = RequestRateLimit(limit=2, window=60)
    assert limit.allow("10.0.0.1") and limit.allow("10.0.0.1")
    assert not limit.allow("10.0.0.1")
    assert limit.allow("10.0.0.2")
