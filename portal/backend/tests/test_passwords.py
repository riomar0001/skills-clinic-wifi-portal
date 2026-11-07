import pytest

from app.core.errors import InvalidInput
from app.core.passwords import (check_username, hash_admin_password, nt_hash, verify_admin_password)


def test_nt_hash_matches_known_value():
    # Well-known NT hash of "password", the value Windows and FreeRADIUS use.
    assert nt_hash("password") == "8846F7EAEE8FB117AD06BDD830B7586C"


@pytest.mark.parametrize("bad", ["short", "x" * 65, "pässword1", "emoji🙂pass"])
def test_wifi_password_rules(bad):
    with pytest.raises(InvalidInput):
        nt_hash(bad)


def test_admin_password_roundtrip():
    stored = hash_admin_password("correct-horse-1")
    assert verify_admin_password("correct-horse-1", stored)
    assert not verify_admin_password("wrong-horse-1", stored)
    assert not verify_admin_password("anything", "garbage")


@pytest.mark.parametrize("bad", ["", "Ana", "-ana", "a b", "x" * 33, "ana!"])
def test_username_rules(bad):
    with pytest.raises(InvalidInput):
        check_username(bad)
