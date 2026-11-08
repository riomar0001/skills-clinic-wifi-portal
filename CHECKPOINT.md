# Checkpoint: Wi-Fi user portal (work in progress)

Branch `wip/wifi-user-portal`. `main` is the version running on the server.

## Goal

- One sign-in page on port 8080 for admins and Wi-Fi users (open to the network; 8081 goes away).
- Wi-Fi users (Student/Faculty ID + Wi-Fi password) get their own portal: update first/last name
  and UMindanao email, see their Wi-Fi connection history, change their password (optional, with
  the disconnect warning; never forced on first connect).
- Admins see each Wi-Fi user's connection history on the user's page.

## Done on this branch

- FreeRADIUS logs every login attempt from the PEAP inner tunnel (`wifi-events.conf`, Dockerfile,
  `start.sh`); `freeradius -XC` passes. Shared `radius-events` volume in `compose.yaml`; portal on
  `8080:8080` for the network.
- Migration `0004` (`connection_events`, `wifi_user_sessions`), `services/connection_log.py`.
- Shared sign-in (admin first, then Wi-Fi user), `/api/auth/status` reports `role`, `/api/me`
  (details, password, connections), admin `GET /api/wifi-users/{id}/connections`.
  Removed 8081, `serve.py` and the self-service endpoint. **51 backend tests pass.**
- Frontend: role-based routing, `/me` portal (status, details, history, password), admin
  "Recent connections" card, old `/change-password` forwards to `/me`. Builds and lints clean.

## Still to do

1. Test end to end on a throwaway stack (not the real one):
   - `docker compose build`, then a test compose in the scratchpad: project `wifitest`,
     portal on `127.0.0.1:8090`, its own `events` and `testdb` volumes, copies of
     `data/certs` and `data/clients.conf`.
   - Set up an admin, add a Wi-Fi user, run `eapol_test` (one good, one wrong password) from a
     container on the `wifitest_default` network, then check the history in both
     `/api/wifi-users/<id>/connections` and `/api/me/connections`.
   - Check `/login` -> `/me` and `/login` -> admin in the browser, desktop and phone width.
2. Update README: port 8080 for everyone, `/me`, connection history, no 8081.
3. Delete this file, merge `wip/wifi-user-portal` into `main`, deploy with `.\setup.ps1`
   (this opens 8080 to the network), and check the real stack.

## Notes

- Wi-Fi user 484470 (Mario Jr Inguito) already exists on the server and its PEAP login was verified.
- Use a strong admin password once 8080 is open to the network.
- Docker Desktop was not running when work stopped (the PC had restarted); it was started again.
