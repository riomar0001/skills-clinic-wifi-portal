# CCE Skills Clinic Wifi Admin Portal

One Wi-Fi login per person. The TP-Link TL-WR840N runs **WPA2-Enterprise**: when someone joins,
their device asks for a **username and password**, and the router checks it with a login server
(FreeRADIUS) running in Docker on an always-on machine.

```
phone ──Wi-Fi──> TL-WR840N ──WAN port──> modem (192.168.0.1) <──Ethernet── server PC (192.168.0.60)
                 192.168.0.83    "is ana / ****** ok?" ──UDP 1812──>  wifi-radius   (FreeRADIUS)
                                                                       wifi-portal   (portal, :8080)
```

**The server must stay on with Docker running.** If it is off, nobody new can join the Wi-Fi.
Devices already connected stay connected.

## What runs

| Container | Port | Who uses it |
|---|---|---|
| `wifi-radius` | UDP **1812** | The router, to check logins. Also records every login attempt. |
| `wifi-portal` | **8080**, the network | Everyone: `http://<server>:8080` (e.g. `http://192.168.0.60:8080`). One sign-in page: admins land in the admin portal, students and faculty in **My Wi-Fi**. |

The portal keeps admins, Wi-Fi users, sessions, login history and an activity log in **SQLite**
(Docker volume `portal-db`). It writes `data/users` for FreeRADIUS, which reloads within a few
seconds of a change. FreeRADIUS writes each login attempt to the `radius-events` volume, and the
portal imports it (90 days are kept).

Because the sign-in page is reachable from the network, **use a strong admin password**. Five wrong
passwords lock a username for five minutes.

## First-time setup

**Step by step, with Docker install, first admin, router, backups and troubleshooting:
[docs/SETUP.md](docs/SETUP.md).** The short version:

```powershell
.\setup.ps1        # Windows
sh setup.sh        # Linux
```

This creates the certificate (valid until 2036), the router secret and starts both containers.
It's safe to run again: it never replaces what already exists.

Then open **http://localhost:8080**. The first admin needs the one-time code in
`data\setup-code.txt`.

## Using the portal (admins)

- **Wi-Fi users:** each person has a **Student ID / Faculty ID** (their Wi-Fi username), first and
  last name, and a **UMindanao email** (`@umindanao.edu.ph`). Add people with a generated password,
  set an **expiry** (1 day, 1 week, 30 or 90 days, or an exact date), disable, reset passwords,
  delete. The password is shown once, to pass on to the person. Each user's page shows their
  **recent connections**: when their devices tried to join, accepted or refused, and the device.
- **Expiry** is enforced by FreeRADIUS itself: after that moment the login is refused, even if the
  portal is stopped.
- **Admins:** add and remove admins; change your own password from the user menu.
- **Server:** certificate details, router settings, the **router secret** (asks for your password
  again), and a database **backup** download.
- **Activity:** who changed what.

IDs are lowercase. Phones often capitalise the first letter, so tell people to type it in
lowercase.

Add a Wi-Fi user from the server's command line instead (the password is asked for, not typed on
the command line):

```powershell
docker exec -it wifi-portal python -m app.cli add-wifi-user --id 484470 --first "Mario Jr" --last Inguito --email m.inguito.484470@umindanao.edu.ph
```

## My Wi-Fi (students and faculty)

Share `http://<server address>:8080` (e.g. `http://192.168.0.60:8080`). People sign in with their
Student/Faculty ID and Wi-Fi password, on the same page admins use, and can:

- see whether their access is active, when it ends, and when they last connected;
- update their first name, last name and UMindanao email;
- see their **connection history** (last 90 days);
- **change their password**. This is optional, never forced. The page warns them that their device
  may drop off the Wi-Fi and will need the new password, and asks them to confirm.

Disabled accounts can't sign in. Expired accounts can sign in to see why, but can't change their
password. A Wi-Fi user's session can never open admin pages.

## Router setup (once)

In `http://192.168.1.1`:

1. **WPS → Disable WPS.** Enterprise mode doesn't work with WPS on.
2. **Wireless → Wireless Security → WPA/WPA2 - Enterprise**
   - Version **WPA2**, Encryption **AES**
   - RADIUS Server IP: the server's address (**192.168.0.60** here)
   - RADIUS Server Port: **1812**
   - RADIUS Server Password: the router secret (portal → Server → **Show secret**)
   - Save. Everyone on the Wi-Fi must rejoin with their own username and password.

**Keep addresses fixed.** In the modem's DHCP settings, reserve **192.168.0.60** for the server
(MAC `E4-A8-DF-BD-85-C9`) and **192.168.0.83** for the router's WAN side (MAC `60:83:E7:E3:B1:BB`).

## Joining from a device

- **iPhone / iPad / Mac:** username and password, then tap **Trust**.
- **Windows:** username and password, then **Connect** at the certificate prompt.
- **Android 13+:** EAP **PEAP**, Phase 2 **MSCHAPV2**, CA certificate **Trust on first use**,
  identity = username. Domain, if asked: `wifi.skillsclinic.local`.
- **Older Android:** choose **Don't validate**, or install `ca.der` (portal → Server) first.

### The certificate warning

Devices ask once to trust the certificate because it was made here, not bought. Check the name is
**wifi.skillsclinic.local** before tapping Trust. A different name may mean someone is faking the
network.

Removing the prompt needs a certificate that phones already trust: one from a public authority
(e.g. Let's Encrypt) for a domain you own, renewed automatically. Android then connects with
"Use system certificates" and the domain name, without the prompt. iPhones and Macs still ask to
trust it once, unless they get a configuration profile.

## Files

| Path | What it is |
|---|---|
| `setup.ps1` | One-time setup; safe to re-run. |
| `compose.yaml` | Both containers. |
| `Dockerfile`, `start.sh`, `reload-users.sh` | FreeRADIUS image; reloads users when `data/users` changes. |
| `wifi-events.conf` | Makes FreeRADIUS record each login attempt for the connection history. |
| `portal/backend` | FastAPI + SQLAlchemy + Alembic, managed with **uv**. |
| `portal/web` | React + TypeScript + Vite, **shadcn/ui** + Tailwind. |
| `data/clients.conf` | Router secret. Private. |
| `data/certs/` | Certificate and keys. **Don't delete**, or every device must trust a new one. |
| `data/users` | Generated from the portal database. Don't edit by hand. |

Back up the `data` folder and the portal database (portal → Server → Download backup).

## Maintenance

```powershell
docker compose ps                          # both should be "Up"
docker compose logs portal --tail 50
.\setup.ps1                                # rebuild and restart, keeps all data
```

Forgot the admin password:

```powershell
docker exec -it wifi-portal python -m app.cli list-admins
docker exec -it wifi-portal python -m app.cli reset-admin <username>
```

Debug a failing login (stop the normal server first):

```powershell
docker compose stop radius
docker run --rm -p 1812:1812/udp -v "${PWD}\data:/mnt/local:ro" wifi-radius sh -c "sed 's/freeradius -f/freeradius -X/' /start.sh > /tmp/s && sh /tmp/s"
# try to connect, read the output, Ctrl+C, then:
docker compose start radius
```

## Development

```powershell
cd portal\backend; uv sync; uv run pytest            # API tests
$env:PORTAL_DB_PATH="$PWD\dev.db"; $env:RADIUS_DATA_DIR="..\..\data"; $env:PORTAL_STATIC_DIR=""
uv run uvicorn --factory app.main:create_app --port 8000
cd portal\web; npm install; npm run dev               # UI on http://localhost:5173, /api goes to :8000
```
