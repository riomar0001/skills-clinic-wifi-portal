"""Server tools, run inside the portal container:

    docker exec -it wifi-portal python -m app.cli list-admins
    docker exec -it wifi-portal python -m app.cli reset-admin <username>
    docker exec -it wifi-portal python -m app.cli add-admin <username>
    docker exec -it wifi-portal python -m app.cli add-wifi-user --id 484470 --first "Mario Jr" \\
        --last Inguito --email m.inguito.484470@umindanao.edu.ph

add-wifi-user asks for the password; with --password-stdin it reads one line from standard input instead,
so the password never appears in the command line or shell history.
"""

import argparse
import getpass
import sys

from app.core.config import load_settings
from app.core.errors import DomainError
from app.db.migrate import upgrade_to_latest
from app.db.session import make_engine, make_session_factory
from app.services.admins import AdminService
from app.services.radius_export import RadiusUsersExporter
from app.services.wifi_users import WifiUserService

CONSOLE = "console"


def _ask_password(from_stdin: bool) -> str | None:
    if from_stdin:
        return sys.stdin.readline().rstrip("\r\n")
    password = getpass.getpass("Password: ")
    if password != getpass.getpass("Repeat it: "):
        print("The passwords don't match.", file=sys.stderr)
        return None
    return password


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list-admins", help="show admin usernames")
    reset = sub.add_parser("reset-admin", help="set a new password for an admin")
    reset.add_argument("username")
    reset.add_argument("--password-stdin", action="store_true", help="read the password from standard input")
    new_admin = sub.add_parser("add-admin", help="add an admin account")
    new_admin.add_argument("username")
    new_admin.add_argument("--password-stdin", action="store_true", help="read the password from standard input")
    add = sub.add_parser("add-wifi-user", help="add a Wi-Fi user")
    add.add_argument("--id", required=True, help="Student ID or Faculty ID (their Wi-Fi username)")
    add.add_argument("--first", required=True, help="first name")
    add.add_argument("--last", required=True, help="last name")
    add.add_argument("--email", required=True, help="UMindanao email")
    add.add_argument("--note", default="")
    add.add_argument("--password-stdin", action="store_true", help="read the password from standard input")
    args = parser.parse_args(argv)

    settings = load_settings()
    upgrade_to_latest(settings.db_path)
    engine = make_engine(settings.db_path)
    exporter = RadiusUsersExporter(settings)
    try:
        with make_session_factory(engine)() as db:
            if args.command == "list-admins":
                for admin in AdminService(db, exporter).list():
                    print(admin.username)
                return 0

            password = _ask_password(getattr(args, "password_stdin", False))
            if password is None:
                return 1

            if args.command == "reset-admin":
                AdminService(db, exporter).reset_password(args.username, password)
                print(f"Password changed for {args.username}, and for their Wi-Fi account with the same name if "
                      "they have one. They are signed out everywhere.")
                return 0

            if args.command == "add-admin":
                admin = AdminService(db, exporter).create(CONSOLE, args.username.strip(), password)
                print(f"Added admin {admin.username}.")
                return 0

            # add-wifi-user
            user = WifiUserService(db, exporter).create(
                CONSOLE, args.id, password, first_name=args.first, last_name=args.last,
                email=args.email, note=args.note)
            print(f"Added Wi-Fi user {user.username} ({user.first_name} {user.last_name}, {user.email}).")
            return 0
    except DomainError as e:
        print(e.message, file=sys.stderr)
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
