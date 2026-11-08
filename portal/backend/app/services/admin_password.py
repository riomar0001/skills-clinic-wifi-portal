"""The one place that checks an admin's password, including admins promoted from Wi-Fi users."""

import hmac

from sqlalchemy.orm import Session

from app.core.errors import InvalidInput, NotAuthenticated, TooManyAttempts
from app.core.passwords import DUMMY_ADMIN_HASH, WIFI_LINKED_HASH, nt_hash, verify_admin_password
from app.db.models import Admin
from app.repositories.wifi_users import WifiUserRepository


def confirm_admin_password(db: Session, admin: Admin, password: str, throttle) -> None:
    """For sensitive actions (router secret, backups): the signed-in admin types their password again, so a
    session left open or stolen isn't enough. Wrong guesses count toward the same lock as signing in.
    throttle is the app's LoginThrottle (not imported here, to keep this module free of the auth service)."""
    if (wait := throttle.seconds_locked(admin.username)) > 0:
        raise TooManyAttempts(f"Too many wrong passwords. Try again in {wait // 60 + 1} minute(s).")
    if not admin_password_matches(db, admin, password or ""):
        throttle.failed(admin.username)
        raise NotAuthenticated("Your password is wrong.")
    throttle.succeeded(admin.username)


def admin_password_matches(db: Session, admin: Admin, password: str) -> bool:
    """A promoted admin's password is their Wi-Fi password, checked against their Wi-Fi account.
    That account must exist, be enabled and not expired: when it can't be checked, access is refused."""
    if admin.password_hash != WIFI_LINKED_HASH:
        return verify_admin_password(password, admin.password_hash)
    verify_admin_password(password, DUMMY_ADMIN_HASH)  # same time as any admin, so the kind isn't revealed
    wifi = WifiUserRepository(db).get(admin.username)
    if wifi is None or not wifi.enabled or wifi.is_expired():
        return False
    try:
        given = nt_hash(password)
    except InvalidInput:
        return False  # can't be a Wi-Fi password
    return hmac.compare_digest(given, wifi.nt_hash)
