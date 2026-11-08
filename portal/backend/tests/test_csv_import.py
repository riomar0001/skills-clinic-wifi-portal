import time

import pytest

from app.core.errors import InvalidInput
from app.core.passwords import generate_wifi_password
from app.services.csv_import import MAX_ROWS, parse_csv
from tests.conftest import person

GOOD = ("Student ID,First Name,Last Name,UMindanao Email,Password\n"
        "111111,Ana,Reyes,a.reyes.111111@umindanao.edu.ph,Sunflower-42\n"
        "222222,Ben,Cruz,b.cruz.222222@umindanao.edu.ph,\n")


def _import(client, text, dry_run=True, **extra):
    return client.post("/api/wifi-users/import", json={"csv": text, "dry_run": dry_run, **extra})


def test_parse_handles_excel_bom_semicolons_and_header_names():
    rows = parse_csv("﻿Email;Surname;Given name;ID\r\nx@umindanao.edu.ph;Doe;Jo;333\r\n\r\n")
    assert len(rows) == 1
    r = rows[0]
    assert (r.username, r.first_name, r.last_name, r.email, r.line) == ("333", "Jo", "Doe", "x@umindanao.edu.ph", 2)


@pytest.mark.parametrize("text, message", [
    ("", "empty"),
    ("ID,First name,Last name\n1,a,b\n", "Missing: Email"),
    ("ID,First name,Last name,Email\n", "only the header"),
    ("ID,First name,Last name,Email\n" + "1,a,b,c\n" * (MAX_ROWS + 1), f"At most {MAX_ROWS}"),
])
def test_parse_rejects_bad_files(text, message):
    with pytest.raises(InvalidInput, match=message):
        parse_csv(text)


def test_generated_passwords_are_valid_and_random():
    pw = {generate_wifi_password() for _ in range(50)}
    assert len(pw) == 50
    assert all(len(p) == 14 and not set(p) & set("01lIoO") for p in pw)


def test_dry_run_checks_without_adding(admin_client):
    r = _import(admin_client, GOOD)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added"] == 0 and body["error_count"] == 0
    assert all(row["password"] is None for row in body["rows"])
    assert admin_client.get("/api/wifi-users").json() == []


def test_import_adds_everyone_and_returns_passwords_once(admin_client, settings):
    future = int(time.time()) + 3600
    r = _import(admin_client, GOOD, dry_run=False, expires_at=future, device_limit=2)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added"] == 2
    passwords = {row["username"]: row["password"] for row in body["rows"]}
    assert passwords["111111"] == "Sunflower-42"
    assert len(passwords["222222"]) == 14  # generated

    users = {u["username"]: u for u in admin_client.get("/api/wifi-users").json()}
    assert set(users) == {"111111", "222222"}
    assert users["222222"]["expires_at"] == future and users["222222"]["device_limit"] == 2
    exported = settings.users_file.read_text()
    assert "111111 NT-Password" in exported and "222222 NT-Password" in exported
    acts = [a["action"] for a in admin_client.get("/api/activity").json()]
    assert "wifi.csv_import" in acts


def test_any_bad_row_means_nobody_is_added(admin_client):
    admin_client.post("/api/wifi-users", json=person("999999", email="taken@umindanao.edu.ph"))
    text = ("ID,First name,Last name,Email,Password\n"
            "111111,Ana,Reyes,ana@umindanao.edu.ph,short\n"          # line 2: bad password
            "999999,Old,User,new@umindanao.edu.ph,\n"                # line 3: ID already exists
            "222222,Ben,Cruz,ben@gmail.com,\n"                       # line 4: not UMindanao
            "333333,,Cruz,taken@umindanao.edu.ph,\n"                 # line 5: no first name, email taken
            "444444,Cy,Diaz,cy@umindanao.edu.ph,\n"                  # line 6: fine
            "444444,Cy,Diaz,cy@umindanao.edu.ph,\n")                 # line 7: duplicate of line 6
    body = _import(admin_client, text, dry_run=False).json()
    assert body["added"] == 0
    errors = {row["line"]: " ".join(row["errors"]) for row in body["rows"]}
    assert "8-64" in errors[2]
    assert "already has" in errors[3]
    assert "UMindanao" in errors[4]
    assert "First name" in errors[5] and "already belongs" in errors[5]
    assert errors[6] == ""
    assert "line 6" in errors[7]
    assert body["error_count"] == 5
    assert [u["username"] for u in admin_client.get("/api/wifi-users").json()] == ["999999"]


def test_import_validates_batch_settings_and_access(admin_client, client):
    assert _import(admin_client, GOOD, expires_at=int(time.time()) - 10).status_code == 400
    assert _import(admin_client, GOOD, device_limit=0).status_code == 422
    admin_client.post("/api/auth/logout")
    assert _import(client, GOOD).status_code == 401


def test_import_accepts_a_body_bigger_than_the_normal_limit(admin_client):
    rows = "".join(f"{100000 + i},First,Last,user{i}@umindanao.edu.ph,\n" for i in range(MAX_ROWS))
    text = "ID,First name,Last name,Email,Password\n" + rows
    assert len(text) > 16 * 1024
    r = _import(admin_client, text)
    assert r.status_code == 200, r.text
    assert r.json()["error_count"] == 0
    # Other endpoints keep the small limit.
    big = admin_client.post("/api/wifi-users", json=person("555555", note="x" * 20000))
    assert big.status_code == 413
