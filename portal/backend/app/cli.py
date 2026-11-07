"""Recovery tools, run inside the portal container:

    docker exec -it wifi-portal python -m app.cli reset-admin <username>
    docker exec -it wifi-portal python -m app.cli list-admins
"""

import argparse
import getpass
import sys

from app.core.config import load_settings
from app.core.errors import DomainError
from app.db.migrate import upgrade_to_latest
from app.db.session import make_engine, make_session_factory
from app.services.admins import AdminService


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    reset = sub.add_parser("reset-admin", help="set a new password for an admin")
    reset.add_argument("username")
    sub.add_parser("list-admins", help="show admin usernames")
    args = parser.parse_args(argv)

    settings = load_settings()
    upgrade_to_latest(settings.db_path)
    engine = make_engine(settings.db_path)
    try:
        with make_session_factory(engine)() as db:
            service = AdminService(db)
            if args.command == "list-admins":
                for admin in service.list():
                    print(admin.username)
                return 0
            password = getpass.getpass("New password: ")
            if password != getpass.getpass("Repeat it: "):
                print("The passwords don't match.", file=sys.stderr)
                return 1
            service.reset_password(args.username, password)
            print(f"Password changed for {args.username}. They are signed out everywhere.")
            return 0
    except DomainError as e:
        print(e.message, file=sys.stderr)
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
