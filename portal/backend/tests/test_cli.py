import io

from sqlalchemy import select

from app import cli
from app.core.passwords import nt_hash
from app.db.models import WifiUser
from app.db.session import make_engine, make_session_factory


def _env(monkeypatch, settings):
    monkeypatch.setenv("PORTAL_DB_PATH", str(settings.db_path))
    monkeypatch.setenv("RADIUS_DATA_DIR", str(settings.radius_dir))
    monkeypatch.setenv("PORTAL_STATIC_DIR", "")


def test_add_wifi_user_reads_password_from_stdin(monkeypatch, settings, capsys):
    _env(monkeypatch, settings)
    monkeypatch.setattr("sys.stdin", io.StringIO("Garden-Path-58\n"))
    code = cli.main(["add-wifi-user", "--id", "484470", "--first", "Mario Jr", "--last", "Inguito",
                     "--email", "m.inguito.484470@umindanao.edu.ph", "--password-stdin"])
    assert code == 0, capsys.readouterr().err
    assert "Garden-Path-58" not in capsys.readouterr().out

    engine = make_engine(settings.db_path)
    try:
        with make_session_factory(engine)() as db:
            user = db.scalar(select(WifiUser).where(WifiUser.username == "484470"))
            assert (user.first_name, user.last_name, user.email) == ("Mario Jr", "Inguito", "m.inguito.484470@umindanao.edu.ph")
            assert user.nt_hash == nt_hash("Garden-Path-58")
    finally:
        engine.dispose()
    assert f"484470 NT-Password := 0x{nt_hash('Garden-Path-58')}" in settings.users_file.read_text()


def test_add_admin(monkeypatch, settings, capsys):
    _env(monkeypatch, settings)
    monkeypatch.setattr("sys.stdin", io.StringIO("long-enough-pass\n"))
    assert cli.main(["add-admin", "484470", "--password-stdin"]) == 0, capsys.readouterr().err
    capsys.readouterr()
    assert cli.main(["list-admins"]) == 0
    assert capsys.readouterr().out.split() == ["484470"]

    monkeypatch.setattr("sys.stdin", io.StringIO("short\n"))
    assert cli.main(["add-admin", "other", "--password-stdin"]) == 1
    assert "10-128" in capsys.readouterr().err


def test_add_wifi_user_rejects_bad_email(monkeypatch, settings, capsys):
    _env(monkeypatch, settings)
    monkeypatch.setattr("sys.stdin", io.StringIO("Garden-Path-58\n"))
    code = cli.main(["add-wifi-user", "--id", "1", "--first", "A", "--last", "B", "--email", "a@gmail.com", "--password-stdin"])
    assert code == 1
    assert "UMindanao" in capsys.readouterr().err
