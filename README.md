# CCE Skills Clinic Wifi Admin Portal for TP-Link TL-WR840N

One Wi-Fi login per person. The TP-Link TL-WR840N runs **WPA2-Enterprise**: when someone joins,
their device asks for a **username and password**, and the router checks it with a login server
(FreeRADIUS) running in Docker on an always-on machine.

```
phone ──Wi-Fi──> TL-WR840N (192.168.1.1) ──LAN cable──> server PC (192.168.1.101)
                 "is ana / ****** ok?" ──UDP 1812──>  wifi-radius   (FreeRADIUS)
                                                      wifi-proxy    (:80, :443)
                                                       └ wifi-portal (portal)
```

**The server must stay on with Docker running.** If it is off, nobody new can join the Wi-Fi.
Devices already connected stay connected.

## What runs

| Container | Port | Who uses it |
|---|---|---|
| `wifi-radius` | UDP **1812** | The router, to check logins. Also records every login attempt. |
| `wifi-portal` | none (behind `wifi-proxy`) | Everyone: `http://<server>` (e.g. `http://192.168.1.101`), or `https://wifi.riomar.dev` with Let's Encrypt. One sign-in page: admins land in the admin portal, students and faculty in **My Wi-Fi**. |
| `wifi-proxy` | TCP **80**, **443**, the network | Front door for the portal. HTTPS with the Let's Encrypt certificate when there is one (port 80 then redirects); plain HTTP on 80 otherwise. |
| `wifi-certs` | none | Optional: gets and renews the Let's Encrypt certificate ([docs/SETUP.md, step 11](docs/SETUP.md#11-optional-a-publicly-trusted-certificate-lets-encrypt)). |
| `wifi-tunnel` | none (outbound to Cloudflare) | Optional: serves the portal through a Cloudflare Tunnel, so a Worker (`fallback/`) can show an **offline page** when the server is down ([step 12](docs/SETUP.md#12-optional-an-offline-page-through-cloudflare-tunnel)). Puts the portal on the internet. |

The portal keeps admins, Wi-Fi users, sessions, login history and an activity log in **SQLite**
(Docker volume `portal-db`). It writes `data/users` for FreeRADIUS, which reloads within a few
seconds of a change. FreeRADIUS writes each login attempt to the `radius-events` volume, and the
portal imports it (90 days are kept).

Because the sign-in page is reachable from the network, **use a strong admin password**. Five wrong
passwords lock a username for five minutes.

## First-time setup

**Step by step, from Docker install to the first phone joining: [docs/SETUP.md](docs/SETUP.md).**
After that, [docs/USING.md](docs/USING.md) covers day-to-day use and
[docs/MAINTENANCE.md](docs/MAINTENANCE.md) covers backups, moves and troubleshooting. The short version:

```powershell
.\setup.ps1        # Windows
sh setup.sh        # Linux
```

This creates the certificate (valid until 2036), the router secret and starts both containers.
It's safe to run again: it never replaces what already exists.

Then open **http://localhost**. The first admin needs the one-time code in
`data\setup-code.txt`.

## Using the portal (admins)

- **Wi-Fi users:** each person has a **Student ID / Faculty ID** (their Wi-Fi username), first and
  last name, and a **UMindanao email** (`@umindanao.edu.ph`). Add people with a generated password,
  set an **expiry** (searchable list from 1 hour to 90 days, or an exact date and time), change
  their ID, disable, reset passwords, delete. The password is shown once, to pass on to the person.
  Each user's page shows their **recent connections**: when their devices tried to join, accepted
  or refused, and the device. It also has a **Wi-Fi QR code** (also on My Wi-Fi) that fills in the
  network **CCE Skills Clinic WiFi** and their ID when scanned; they type the password.
- **Device limit:** each account can be limited to a number of devices (default 2). The first ones
  to join are registered; others are refused until an admin removes one.
- **Import CSV:** add a whole class list at once. The file is checked first and nobody is added
  unless every row is valid; generated passwords can be downloaded once.
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
docker exec -it wifi-portal python -m app.cli add-wifi-user --id 123456 --first Juan --last "Dela Cruz" --email j.delacruz.123456@umindanao.edu.ph
```

## My Wi-Fi (students and faculty)

Share `http://<server address>` (e.g. `http://192.168.1.101`). People sign in with their
Student/Faculty ID and Wi-Fi password, on the same page admins use, to see their access and
connection history, update their name and email, and (optionally) change their password. Details
in [docs/USING.md](docs/USING.md#my-wi-fi-for-students-and-faculty).

An admin can also have a Wi-Fi account with the same name. Changing the admin password sets that
Wi-Fi password too, so one password works for both. Admin accounts are checked first, so that
password opens the admin portal ([details](docs/USING.md#an-admin-who-also-uses-the-wi-fi)).

## Router setup (once)

In `http://192.168.1.1`:

1. **WPS → Disable WPS.** Enterprise mode doesn't work with WPS on.
2. **Wireless → Wireless Security → WPA/WPA2 - Enterprise**
   - Version **WPA2**, Encryption **AES**
   - RADIUS Server IP: the server's address (**192.168.1.101** here)
   - RADIUS Server Port: **1812**
   - RADIUS Server Password: the router secret (portal → Server → **Show secret**)
   - Save. Everyone on the Wi-Fi must rejoin with their own username and password.

**Keep the server's address fixed.** In the router's **DHCP → Address Reservation**, reserve
**192.168.1.101** for the server's Ethernet MAC (`XX-XX-XX-XX-XX-XX`, from `ipconfig /all`).

**Other routers work too.** Any router or access point with **WPA2-Enterprise** (802.1X) and a
RADIUS server setting can replace or join the TL-WR840N, with the same settings and the network
name **CCE Skills Clinic WiFi**. Several routers can share one server for more coverage and more
devices. Mesh systems and ISP modems often lack Enterprise mode. See
[docs/MAINTENANCE.md](docs/MAINTENANCE.md#using-another-router-or-more-than-one).

**Changing the server's address later** is fine: update the router's **RADIUS Server IP** and the
`wifi` DNS record in Cloudflare (if you use HTTPS without the tunnel). Nothing in the project needs changing. See
[docs/MAINTENANCE.md](docs/MAINTENANCE.md#changing-the-servers-address).

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

To remove the prompt on Android, the optional `wifi-certs` container gets a free Let's Encrypt
certificate for a domain on Cloudflare (e.g. `wifi.riomar.dev`) and renews it automatically.
Android then connects with "Use system certificates" and the domain name. iPhones, Macs and Windows
still ask once (and may ask again after a renewal), unless they get a configuration profile.
Setup: [docs/SETUP.md, step 11](docs/SETUP.md#11-optional-a-publicly-trusted-certificate-lets-encrypt).

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
| `certs/` | Optional Let's Encrypt container (`wifi-certs`). |
| `proxy/` | nginx front for the portal (`wifi-proxy`): HTTPS when there's a Let's Encrypt certificate. |
| `letsencrypt/` | Cloudflare token and domain for it. Private; not in Git. |
| `data/letsencrypt/` | The Let's Encrypt certificate, when there is one. Used instead of `data/certs/server.pem`. |
| `data/users` | Generated from the portal database. Don't edit by hand. |
| `tunnel/` | Cloudflare Tunnel token (setup step 12). Private; not in Git. |
| `fallback/` | Cloudflare Worker that shows the "portal offline" page; deployed with `npm run deploy`. |

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
