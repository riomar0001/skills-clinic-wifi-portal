# Checkpoint: Wi-Fi user portal (work in progress)

Branch `wip/wifi-user-portal`. `main` is the version running on the server.

## Goal

- One sign-in page on port 8080 for admins and Wi-Fi users (open to the network; 8081 goes away).
- Wi-Fi users (Student/Faculty ID + Wi-Fi password) get their own portal: update first/last name
  and UMindanao email, see their Wi-Fi connection history, change their password (optional, with
  the disconnect warning; never forced on first connect).
- Admins see each Wi-Fi user's connection history on the user's page.

## Done on this branch (not yet tested together)

- FreeRADIUS logs every login attempt from the PEAP inner tunnel: `wifi-events.conf`, Dockerfile
  sed into `inner-tunnel`, `start.sh` creates `/var/log/wifi-events/auth.log` and caps it at 10 MB.
  `freeradius -XC` passes.
- `compose.yaml`: shared `radius-events` volume (rw in radius, ro in portal); portal on `8080:8080`.
- Models + migration `0004`: `connection_events`, `wifi_user_sessions` (round-trips cleanly).
- `services/connection_log.py`: incremental import with offset in `meta`, strict line parsing,
  90 days / 50k rows kept.
- `services/auth.py`: `login()` returns `(token, Identity)`; checks admin, then Wi-Fi user;
  `identify()`, `resolve_wifi_user()`, `logout()` clears both session kinds.
- `services/wifi_users.py`: `change_own_password(user, current, new, throttle, keep_token_hash)`,
  `update_own_details(user, ...)`.
- `config.py`: `radius_events_file`; removed `admin_port` / `self_service_port`.

## Still to do

1. Backend wiring
   - `api/schemas.py`: `AuthStatus` -> `{needs_setup, role, username, name}`; `MeOut`,
     `MeUpdateIn`, `MePasswordIn`, `ConnectionOut`.
   - `api/deps.py`: `get_current_wifi_user` (Wi-Fi sessions only; admin deps stay admin-only).
   - `api/routes/auth.py`: login/status/setup return the new `AuthStatus`.
   - New `api/routes/me.py`: `GET/PATCH /api/me`, `PUT /api/me/password`, `GET /api/me/connections`.
   - `api/routes/wifi_users.py`: `GET /api/wifi-users/{id}/connections`.
   - Remove `api/routes/self_service.py`, the self-service port logic in `api/middleware.py`,
     `app/serve.py`; `main.py` imports; `portal/Dockerfile` back to a plain uvicorn CMD on 8080.
   - Import connection events on startup (`main._startup`).
2. Tests: replace `tests/test_self_service.py` with `/api/me` tests (sign-in as Wi-Fi user, role
   routing, Wi-Fi session can't reach admin API, disabled user signed out, expired user can sign
   in but not change password); `test_connection_log.py` (parsing, injection-safe, truncation).
3. Frontend
   - `AuthStatus` type; login page label "Student/Faculty ID or admin username"; route by role.
   - `RequireAuth` per role; Wi-Fi user portal at `/me` (status, details form, history, password
     with warning); remove `features/self-service` and the 8081 page.
   - Admin user detail: "Recent connections" card.
4. Deploy (`.\setup.ps1`), test end to end with `eapol_test` (history shows accept/reject),
   update README (port 8080 for everyone, `/me`), commit each step.

## Notes

- Wi-Fi user 484470 (Mario Jr Inguito) already exists on the server and its PEAP login was verified.
- Use a strong admin password once 8080 is open to the network.
