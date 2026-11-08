# Setup guide

How to install the CCE Skills Clinic Wifi Admin Portal with Docker, create the first admin, and
connect the TP-Link router. Works on **Windows** (Docker Desktop) and **Linux** (for example a
Raspberry Pi 4/5 with a 64-bit OS, or any small PC).

When you're done you'll have:

- **wifi-radius**: the login server (FreeRADIUS). The router asks it whether a Wi-Fi username and
  password are right.
- **wifi-portal**: the website at `http://<server>`. Admins manage Wi-Fi users there, and
  students and faculty sign in to **My Wi-Fi** on the same page.
- **wifi-proxy**: the portal's front door on ports 80 and 443. It serves HTTPS once you add a
  Let's Encrypt certificate (step 12).
- **wifi-certs**: optional; gets and renews that certificate. Does nothing until step 12.
- **wifi-tunnel**: optional; serves the portal through Cloudflare so people see an "offline" page
  when the server is down. Only runs after step 13.

---

## 1. What you need

| | |
|---|---|
| A machine that stays on | Windows 10/11 or Linux, 2 GB RAM is plenty. If it's off, nobody new can join the Wi-Fi. |
| A network cable | The server must be **wired** to the modem or a router LAN port, not on Wi-Fi (once Wi-Fi asks for logins, a server on Wi-Fi couldn't log itself in). |
| The project folder | This repository, including the `data` folder if you're moving an existing install. |
| The TP-Link TL-WR840N | And its admin password, to change its Wi-Fi security later. Another router works too if it supports WPA2-Enterprise ([Using another router](#using-another-router-or-more-than-one)). |

## 2. Install Docker

### Windows

1. Install **Docker Desktop** from <https://www.docker.com/products/docker-desktop/> (it sets up WSL 2).
2. Open Docker Desktop → **Settings → General** → tick **Start Docker Desktop when you sign in**.
3. Install **PowerShell 7** if `pwsh` doesn't run yet: `winget install Microsoft.PowerShell`.
4. Stop the PC from sleeping when plugged in:
   ```powershell
   powercfg /change standby-timeout-ac 0
   ```

### Linux

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # then sign out and back in
docker version                      # should show a Server version
```

Docker starts on boot by itself, and the containers restart with it.

## 3. Get the project

Copy the project folder to the server, or clone it:

```bash
git clone <repository-url> skills-clinic-wifi-portal
cd skills-clinic-wifi-portal
```

## 4. Run the setup

**Windows** (PowerShell 7, in the project folder):

```powershell
.\setup.ps1
```

**Linux** (in the project folder):

```bash
sh setup.sh
```

The first run takes a few minutes, because it builds both images. It:

1. creates the **certificate** (`data/certs/`, valid 10 years). Phones remember it, so keep it.
2. creates the **router secret** (`data/clients.conf`). The router needs it later.
3. starts both containers.
4. prints a **setup code** for the first admin.

Running it again is safe: it never replaces the certificate, the secret or any data.

> **Linux:** the portal container runs as user ID 1000. If your Linux user isn't 1000 (`id -u`),
> run `sudo chown -R 1000:1000 data` once, or the portal can't write the user list.

Check that both are up:

```bash
docker compose ps
```

`wifi-radius`, `wifi-portal`, `wifi-proxy` and `wifi-certs` should all say **Up**.

## 5. Create the first admin

### Option A: in the browser (recommended)

1. On the server, open **http://localhost**. You're sent to **Create the first admin**.
2. Enter the **setup code**. `setup` printed it; it's also in `data/setup-code.txt`, or run:
   ```bash
   docker compose logs portal | grep "setup code"
   ```
3. Choose an admin **username** (lowercase) and a **password of at least 10 characters**.
4. You're signed in. The setup code stops working once the first admin exists.

The code proves you have access to the server itself, so nobody else on the network can claim the
portal first.

### Option B: from the command line

```bash
docker exec -it wifi-portal python -m app.cli add-admin <username>
```

It asks for the password twice. It isn't shown and isn't saved in your shell history.

### More admins later

- In the portal: **Admins → Add admin**.
- Or: `docker exec -it wifi-portal python -m app.cli add-admin <username>`

### Forgot an admin password

```bash
docker exec -it wifi-portal python -m app.cli list-admins
docker exec -it wifi-portal python -m app.cli reset-admin <username>
```

That admin is signed out everywhere and uses the new password from then on.

> The sign-in page is reachable from the whole network, so use **strong admin passwords**. Five
> wrong passwords lock a username for five minutes.

### An admin who also uses the Wi-Fi

Admins and Wi-Fi users sign in on the same page, and **admin accounts are checked first**. If an
admin account and a Wi-Fi account share the same name (for example your Student ID):

- **Changing the admin password changes the Wi-Fi password too** (from **Your account**, or with
  `reset-admin`), so one password works for both. It must then also be a valid Wi-Fi password:
  8-64 plain keyboard characters. Your devices ask for the new password the next time they join.
- **Same password:** signing in always opens the admin portal. You can still see your Wi-Fi account
  there under **Wi-Fi users**, but not My Wi-Fi.
- **Different passwords** (only if the Wi-Fi password is reset separately afterwards): the admin
  password opens the admin portal, the Wi-Fi password opens My Wi-Fi.

The Wi-Fi itself only uses the Wi-Fi account and password. Changing a Wi-Fi password never changes
the admin password.

## 6. Give the server a fixed address

The router finds the login server by its IP address, so that address must not change.

1. Find the server's address and network adapter MAC:
   - Windows: `ipconfig /all` (look at the **Ethernet** adapter).
   - Linux: `ip -4 addr` and `ip link`.
2. In your **modem's** DHCP settings (or the router's, if the server is plugged into it), add an
   **address reservation** for that MAC address.

If the server's address ever changes, Wi-Fi logins stop until you update **RADIUS Server IP** in the
router (step 8). See [Changing the server's address](#changing-the-servers-address) for the full list.

## 7. Firewall

The server needs these open:

| Port | From | Why |
|---|---|---|
| UDP **1812** | The TP-Link router | Wi-Fi logins |
| TCP **80** and **443** | The network | The portal (admins and Wi-Fi users); 443 once it has HTTPS (step 12) |

- **Windows:** Docker Desktop adds its own firewall rules when it starts. If a phone on the Wi-Fi
  can't open `http://<server>`, allow Docker Desktop in **Windows Security → Firewall → Allow
  an app**.
- **Linux:** Docker opens published ports itself, even past `ufw`. Nothing to add unless another
  firewall sits in front.

Test from another device on the network: open `http://<server address>`. The sign-in page
should load.

## 8. Connect the router

In the TP-Link at `http://192.168.1.1`:

1. **WPS → Disable WPS.** Enterprise mode doesn't work while WPS is on.
2. In the portal, go to **Server → Show secret**, enter your admin password, and copy the secret.
3. **Wireless → Wireless Security → WPA/WPA2 - Enterprise**:
   - Version **WPA2**, Encryption **AES**
   - RADIUS Server IP: the server's fixed address (step 6)
   - RADIUS Server Port: **1812**
   - RADIUS Server Password: the secret you copied
4. **Save.** Every device on the Wi-Fi disconnects and must rejoin with its own username and password.

Add yourself as a Wi-Fi user **before** saving, or nobody can join (step 9).

### Using another router (or more than one)

Nothing on the server is tied to the TL-WR840N. The router only passes each login to the server and
lets the device on if the server says yes; accounts, passwords, expiry, device limits, history and
the QR code all live on the server. Any router or access point works if its Wi-Fi security menu has
**WPA2-Enterprise** (also called *WPA/WPA2-Enterprise* or *802.1X*) with fields for a **RADIUS
server IP, port and password**. If it only offers *WPA2-Personal*, it won't work.

| Usually works | Usually doesn't |
|---|---|
| Most standalone TP-Link, ASUS and Netgear routers | ISP-supplied modem/routers (often locked down) |
| Business access points: TP-Link Omada, Ubiquiti UniFi, MikroTik, Aruba Instant On, Ruckus, Cisco | Many mesh systems (e.g. TP-Link Deco, eero) |
| WPA3-Enterprise routers (they also offer WPA2-Enterprise) | Travel and pocket routers |

Check the exact model's manual before buying. To set one up:

1. Turn off **WPS** if it has it.
2. Wi-Fi security **WPA2-Enterprise**, encryption **AES**, RADIUS server = the server's fixed
   address, port **1812**, password = the router secret (**Server → Show secret**). Accounting
   (port 1813) isn't used; leave it off or empty.
3. Name the network **CCE Skills Clinic WiFi**, or the QR codes point to the wrong network. To use
   another name, change `WIFI_SSID` in `portal/web/src/lib/wifi.ts` and run the setup again.
4. The router must reach the server on **UDP 1812**: plug its WAN port into the same network as the
   server, as with the TL-WR840N, and allow 1812 in the firewall (step 7).

The server already accepts any router that knows the secret, so nothing changes on the server, and
devices that joined before only need to rejoin if the network name changed.

**More than one router**, for example one per room: give them all the same network name, security
settings and RADIUS server. People then move between them with the same login, and the device limit
and history count across all of them. This is also how to serve more people at once: one TL-WR840N
handles roughly 15–25 active devices.

## 9. Add Wi-Fi users and test

1. Portal → **Wi-Fi users → Add Wi-Fi user**:
   - **Student ID / Faculty ID**: their Wi-Fi username (lowercase letters, digits, `.`, `-`, `_`).
   - **First name**, **last name**, and **UMindanao email** (must end in `@umindanao.edu.ph`; each
     email can belong to only one person).
   - **Password**: use **Generate** for an easy-to-type one, or type your own (8-64 characters).
   - **Access expires**: **Never**, a length from **1 hour to 90 days** (type in the box to search,
     e.g. `6h`, `2w`, `30`), or an exact date and time. After that moment the Wi-Fi refuses the login.
2. Pass the ID and password on. The password is shown only once.
3. On a phone, join the Wi-Fi:
   - **iPhone/Mac:** enter the ID and password, then tap **Trust**.
   - **Android:** EAP **PEAP**, Phase 2 **MSCHAPV2**, CA certificate **Trust on first use**,
     Identity = ID. Domain, if asked: `wifi.skillsclinic.local`. (With a Let's Encrypt
     certificate, step 12, use **Use system certificates** and your domain instead.)
   - **Windows:** enter the ID and password, then **Connect**.
4. In the portal, the user's page shows the attempt under **Recent connections**.

You can also add Wi-Fi users from the command line (it asks for the password):

```bash
docker exec -it wifi-portal python -m app.cli add-wifi-user --id 123456 --first Juan --last "Dela Cruz" --email j.delacruz.123456@umindanao.edu.ph
```

## 10. Managing Wi-Fi users

Open **Wi-Fi users**, search by name, ID or email, and click a person. On their page:

| To | Do this |
|---|---|
| Fix their name, email or note | **Details**, then **Save changes**. |
| Change their **Student/Faculty ID** | Edit the ID in **Details** and save. It is also their Wi-Fi username, so their devices need the new ID to join; the old ID stops working at once. Their connection history moves to the new ID. |
| Block them right away | Turn off **Wi-Fi access**. Devices already connected stay on until they reconnect. |
| Give access for a limited time | **Expires → Set/Change**: 1 hour to 90 days, or an exact date and time. **Never** removes the limit. |
| Replace a forgotten password | **Reset password**. The new one is shown once. |
| Remove them for good | **Delete user**. |
| See if their phone is reaching the Wi-Fi | **Recent connections**: each attempt, accepted or refused, with the device's address. |
| Limit how many devices they use | **Device limit**: no limit, or 1 to 10. New users get 2. |
| Let them switch to a new phone | **Devices → Remove** the old one. The next new device to join takes its place. |
| Help them join quickly | Show or print **Join with a QR code**. Scanning fills in the network (**CCE Skills Clinic WiFi**), PEAP / MSCHAPV2 and their ID; they type the password. Works on many Android phones; iPhones ignore Wi-Fi QR codes for this kind of network, so join from **Settings → Wi-Fi**. |

### How the device limit works

- The first devices to join with an account are **registered**, up to the limit. The **Devices**
  card shows them with when each was first and last seen.
- Once the limit is reached, a different device is **refused**, even with the right password.
  Registered devices keep working.
- Devices are recognized by their Wi-Fi address (MAC). Most phones use a **different private
  address for each network**, which stays the same for this Wi-Fi, so that's fine. If a phone is
  set to change its address every time it joins, it counts as a new device; turn that off for
  this network (Android: *Privacy → Use device MAC* or *Per-network MAC*; iPhone: *Private Wi-Fi
  Address → Fixed*).
- The limit applies within about 5 seconds of a new device joining. Lowering the limit doesn't
  remove registered devices; remove the extra ones yourself.

### Add many people from a CSV file

1. **Wi-Fi users → Import CSV.** Click **Template** for a sample file, or use your own class list.
2. The first row names the columns: **Student ID** (or *Faculty ID*, *ID*), **First Name**,
   **Last Name**, **UMindanao Email**, and optionally **Password**. Order doesn't matter and extra
   columns are ignored. Leave Password empty to have one made up.
   In Excel use **File → Save As → CSV UTF-8**. Up to 1000 people and 1 MB per file.
3. Choose the **expiry** and **device limit** for everyone in the file.
4. **Check file.** Nothing is added yet. Rows with problems (wrong email domain, an ID that
   already exists, the same person twice, a short password) are listed with their line number.
   Fix them in the file and choose it again. **Nobody is added until every row is valid.**
5. **Add N users**, then **Download passwords (CSV)**. The passwords are shown only this once;
   share each one with its owner only, and delete the downloaded file when done.

The list's **Active / Expired / Disabled** tabs and the dashboard counts show who can join right now.
**Activity** records who changed what.

## 11. My Wi-Fi (for students and faculty)

Share `http://<server address>`. People sign in with their **Student/Faculty ID** and **Wi-Fi
password** on the same page admins use, and can:

- see whether their access is active, when it ends, and when they last connected;
- scan their **Wi-Fi QR code** with another phone to join with their ID filled in (no password in it);
- update their first name, last name and UMindanao email (not their ID);
- see their **connection history** (last 90 days) and their registered **devices**;
- **change their password**. This is optional, never required. The page warns that their device may
  drop off the Wi-Fi and will need the new password, and asks them to confirm.

Disabled accounts can't sign in. Expired accounts can sign in to see why, but can't change their
password. A Wi-Fi user's sign-in never opens admin pages.

## 12. Optional: a publicly trusted certificate (Let's Encrypt)

The certificate from step 4 is made here, so every device asks once whether to trust it. With a
free **Let's Encrypt** certificate for a domain you own, Android connects with **Use system
certificates** and no warning. iPhones, Macs and Windows still ask once: an iPhone shows
**Not Trusted** for every Wi-Fi certificate it hasn't seen, even a Let's Encrypt one. That's normal;
tap **Trust** if it shows your name (e.g. `wifi.riomar.dev`) issued by Let's Encrypt (`R…` or `YR…`).

The same certificate also gives the **portal HTTPS**: `https://wifi.riomar.dev` instead of
`http://<server>`, so sign-ins are encrypted on the wired network too.

You need a domain whose DNS is on **Cloudflare** (this install uses `riomar.dev`). The server does
**not** need to be reachable from the internet: the `wifi-certs` container proves you own the domain
by adding a temporary TXT record through Cloudflare's API, then removes it. The Wi-Fi login itself
never looks the name up; only the portal's HTTPS address needs a DNS record (step b).

**Trade-off:** the certificate is renewed automatically about every two months. Android (system
certificates + domain) doesn't notice, but iPhones, Macs and Windows may ask to **Trust** again after
a renewal. If that bothers your users more than the one-time warning, stay with the self-made one.

### a. Make a Cloudflare API token

1. <https://dash.cloudflare.com> → profile icon (top right) → **My Profile → API Tokens → Create Token**.
2. **Token name:** `wifi-certs`.
3. Click the **Edit zone DNS** card. Leave **Permissions** as `Zone · DNS · Edit`, and set
   **Zone Resources** to `Include · Specific zone · riomar.dev` (your domain).
4. **Token expiration:** No expiration. **Client IP address filtering:** leave empty.
5. **Continue to summary → Create Token**, then **Copy** the token. Cloudflare shows it only once.

The token can only edit DNS for that one domain. Never paste it into chat, email or the repository.

### b. Put the token and name on the server

In the project folder's `letsencrypt` folder (setup creates it; Git ignores it), create two text files:

| File | Contents (one line) |
|---|---|
| `letsencrypt/cloudflare.ini` | `dns_cloudflare_api_token = <the token>` |
| `letsencrypt/domain` | the name for the certificate, e.g. `wifi.riomar.dev` |

In Notepad use **Save as type: All files (\*.\*)**, or the file ends up as `cloudflare.ini.txt`.
On Linux, `chmod 600 letsencrypt/cloudflare.ini`.

**Add the DNS record before step c.** Once the certificate exists, every `http://` visit to the portal,
even by IP address, is redirected to `https://<the name>`, so the name must lead to the server.
In Cloudflare: your domain → **DNS → Records → Add record**:

| Type | Name | IPv4 address | Proxy status |
|---|---|---|---|
| `A` | `wifi` | the server's fixed address, e.g. `192.168.0.60` | **DNS only** (grey cloud) |

It must be **DNS only**: Cloudflare's proxy can't reach a private address. The record only works on
your own network, and it reveals nothing beyond that private address. Check it from the server:
`nslookup wifi.riomar.dev 1.1.1.1` should answer `192.168.0.60`. With step 13, the tunnel's own
record replaces this one.

### c. Test, then turn it on

1. Test the token and name without getting a real certificate:
   ```bash
   docker compose build certs
   docker compose run --rm certs once --dry-run
   ```
   It should end with **Dry run worked**. If not, see the Troubleshooting table.
2. Run setup again (step 4). It starts `wifi-certs`, which gets the certificate within a minute or two:
   ```bash
   docker compose logs certs --tail 20     # "Installed the certificate for wifi.riomar.dev"
   docker compose logs radius --tail 20    # "Using the Let's Encrypt certificate"
   ```
   The login server restarts by itself to use it (a few seconds; connected devices stay on).
3. Portal → **Server** shows the certificate as **publicly trusted**, and the joining instructions
   shown after adding a Wi-Fi user switch to the new Android settings.
4. The portal is now `https://wifi.riomar.dev` (padlock in the browser). `http://<server>` redirects
   there, so old bookmarks keep working. Share the new address with your users.
5. Devices that joined before must **forget the network and join again**, because the certificate
   changed. On Android: EAP **PEAP**, Phase 2 **MSCHAPV2**, CA certificate **Use system
   certificates**, Domain **wifi.riomar.dev**, Identity = ID.

`wifi-certs` checks twice a day and renews in the certificate's last 30 days. A failed attempt is
retried after an hour, and the current certificate stays in use meanwhile. The login server and
`wifi-proxy` pick up a renewed certificate by themselves. If the certificate is ever removed or
expires, the portal goes back to plain `http://<server>` on its own.

### Turn it off

```bash
docker compose stop certs
```

Then delete `letsencrypt/cloudflare.ini` and the files in `data/letsencrypt/`. The login server
switches back to the self-made certificate by itself, and devices must forget the network and rejoin.
The portal goes back to `http://<server>` within about 10 seconds; you can then delete the DNS record.
Also delete the token in Cloudflare (**API Tokens → … → Delete**).

## 13. Optional: an offline page through Cloudflare Tunnel

Normally a browser goes straight to the server, so when the server is off it just times out. With a
**Cloudflare Tunnel**, the `wifi-tunnel` container keeps a connection open from the server to
Cloudflare, and `https://wifi.riomar.dev` is served through Cloudflare. When the server is off or
restarting, a small Cloudflare Worker (`fallback/`) shows a **"Wi-Fi portal offline"** page instead
of an error. It works with or without step 12.

**Trade-offs. Read these first:**

- The portal becomes **reachable from anywhere on the internet**, not just the clinic. Use strong
  admin passwords. Wrong-password locks still work, per visitor.
- It **needs the internet**. If the clinic's internet is down, `wifi.riomar.dev` doesn't load even
  inside the clinic. On the clinic network, `https://<server address>` still works (accept the name
  warning). Wi-Fi logins don't need the internet at all.
- Cloudflare decrypts and re-encrypts the portal traffic on its servers.
- Everyone inside the clinic reaches Cloudflare from the same public address. So 5 wrong passwords
  for a name, from inside the clinic, lock that name for the whole clinic for 5 minutes.
- Bonus: if the server's address changes, the DNS record no longer needs updating.

### a. Create the tunnel

1. <https://one.dash.cloudflare.com> → your account → **Networks → Connectors → Cloudflare Tunnels
   → Create a tunnel** (older dashboards: **Networks → Tunnels**). Choose **Cloudflared**.
2. **Name:** `wifi-portal` → **Save tunnel**.
3. Under **Choose your environment**, pick **Docker**. The command shown ends with `--token eyJ…`.
   Copy **only the long token** after `--token`.
4. In the project folder, save it in a new file `tunnel/token` (one line, nothing else). In Notepad
   use **Save as type: All files (\*.\*)**. Git ignores this folder. Never paste the token into chat
   or email: anyone with it can run your tunnel.
5. Run setup again (step 4). It starts `wifi-tunnel` because the token file exists. Within a few
   seconds the dashboard shows the tunnel as **Healthy**, and
   `docker compose logs tunnel --tail 20` shows `Registered tunnel connection`.

### b. Point the name at the tunnel

1. Cloudflare → your domain → **DNS → Records**: **delete** the `wifi` A record from step 12b.
   The tunnel can't add its own record while that one exists. `https://wifi.riomar.dev` doesn't
   load until the next step is done.
2. Back in the tunnel → **Published application routes** (older dashboards: **Public hostnames**)
   → **Add**:

   | Field | Value |
   |---|---|
   | Subdomain | `wifi` |
   | Domain | `riomar.dev` |
   | Path | empty |
   | Service URL | `http://proxy:8081` (older dashboards: Service type **HTTP**, URL `proxy:8081`) |

   It must be `http://proxy:8081`: plain HTTP is fine because that hop stays inside Docker, and
   visitors still get HTTPS from Cloudflare. That entrance takes the visitor's address from
   Cloudflare, so the wrong-password lock can't be dodged. `portal:8080` would let anyone fake their
   address, and `proxy:80` loops forever.
3. **Add route.** Cloudflare adds a proxied (orange cloud) `wifi` record pointing at the tunnel.
   Open `https://wifi.riomar.dev`, also on a phone using mobile data: the portal should load.

### c. Deploy the offline page

Once, from any computer with Node.js (the server is fine), in the project folder:

```bash
cd fallback
npm install
npm test               # checks the page logic
npx wrangler login     # opens Cloudflare in the browser; sign in and allow access
npm run deploy
```

If your name isn't `wifi.riomar.dev`, change `routes` in `fallback/wrangler.jsonc` first. The
message is `MESSAGE` in `fallback/src/index.js`; run `npm run deploy` again after changing it.
Cloudflare's free plan runs the Worker for up to 100,000 requests a day, far more than the portal
uses.

Test it:

```bash
docker compose stop tunnel      # pretend the server is off
```

Within a minute, `https://wifi.riomar.dev` shows **Wi-Fi portal offline** (it retries every minute
by itself). Then bring it back:

```bash
docker compose start tunnel
```

### Turn it off

1. `docker compose stop tunnel`, then delete `tunnel/token`.
2. In Cloudflare, delete the Worker (**Workers & Pages → wifi-portal-fallback → Settings → Delete**),
   then the tunnel (**Networks → Connectors → wifi-portal → Delete**).
3. **DNS → Records:** delete the tunnel's `wifi` CNAME record and add the A record from step 12b again.

---

## Everyday commands

Run these in the project folder.

| What | Command |
|---|---|
| Status | `docker compose ps` |
| Portal log | `docker compose logs portal --tail 50` |
| Login server log | `docker compose logs radius --tail 50` |
| Certificate log (step 12) | `docker compose logs certs --tail 50` |
| Tunnel log (step 13) | `docker compose logs tunnel --tail 50` |
| Restart both | `docker compose restart` |
| Stop both | `docker compose stop` |
| Start again | `docker compose start` (or run setup again) |
| Update to a new version | `git pull`, then run setup again (it rebuilds and keeps all data) |

## Backups

Two things hold everything:

1. **The `data` folder**: certificate, keys, router secret. Copy it somewhere safe once; it rarely changes.
   With step 12, also keep the `letsencrypt` folder (the Cloudflare token), or just make a new token.
   With step 13, keep the `tunnel` folder too.
2. **The portal database**: admins, Wi-Fi users, history. Download it from the portal:
   **Server → Download backup** (a `.db` file). Do this regularly. Keep it private: it contains password hashes.

### Restore a database backup

Put the backup file in the project folder as `wifi-portal-backup.db`, then:

```bash
docker compose stop portal
docker run --rm --volumes-from wifi-portal -v "$PWD:/backup" alpine:3.20 sh -c 'cp /backup/wifi-portal-backup.db /var/lib/portal/portal.db && rm -f /var/lib/portal/portal.db-wal /var/lib/portal/portal.db-shm && chown 1000:1000 /var/lib/portal/portal.db'
docker compose start portal
```

On Windows PowerShell use `"${PWD}:/backup"` instead of `"$PWD:/backup"`. The portal rebuilds the
login server's user list from the restored database when it starts.

## Moving to another machine

1. On the old server: download a database backup, and copy the whole project folder **including `data`**
   (and `letsencrypt`, if you use step 12; the new server gets a fresh certificate with the same name,
   and `tunnel`, if you use step 13).
2. On the new machine: install Docker (step 2), put the folder there, and run setup (step 4).
   Because `data` came along, the certificate and router secret stay the same, so phones won't see
   a new certificate.
3. Restore the database backup (above).
4. Give the new machine a fixed address (step 6), then follow
   [Changing the server's address](#changing-the-servers-address) if it differs from the old one.
5. Stop the old one: `docker compose --profile tunnel down` in its project folder. With step 13, a
   tunnel left running on the old machine would get some of the visitors.

## Changing the server's address

The address can change any time (a new network, a new reservation, a move). Nothing in the project
stores it: the login server accepts the router from any address, and the Let's Encrypt certificate is
tied to the name (`wifi.riomar.dev`), not the address. Only these places point to the server:

| Where | What to change | Until you do |
|---|---|---|
| Modem DHCP (step 6) | Reserve the new address for the server's MAC, or set it on the server itself | The address may change again |
| Router → **Wireless Security** (step 8), on every router | **RADIUS Server IP** = the new address, then **Save** | Nobody can join the Wi-Fi |
| Cloudflare → your domain → **DNS → Records** (step 12) | Edit the `wifi` record's **IPv4 address**; keep it **DNS only**. Not needed with step 13: the tunnel finds the server by itself | `https://wifi.riomar.dev` doesn't load |

Nothing else changes: no rebuild or setup run, and devices keep their Wi-Fi settings without
rejoining or trusting anything again. Some devices may keep using the old address for a few minutes
after the DNS change, until their cached lookup expires.

Check afterwards: the portal's dashboard should say the login server is *Running*, a phone should be
able to join, and `nslookup wifi.riomar.dev 1.1.1.1` should answer the new address.

## Security notes

- **The portal uses plain HTTP unless step 12 is done.** On the Wi-Fi, each person's traffic is
  encrypted by WPA2-Enterprise, but on the wired network a sign-in could be read by someone sniffing
  it. With step 12, the portal is HTTPS-only. Either way, don't publish ports 80/443 to the internet,
  and never publish the portal container's own port 8080: it trusts the proxy's visitor-address headers.
- **With step 13 the portal is on the internet** through Cloudflare. Use strong admin passwords, and
  keep the tunnel's service at `proxy:8081`. The **tunnel token** (`tunnel/token`) lets anyone run
  your tunnel: if it leaks, delete the tunnel in Cloudflare and make a new one.
- **Wrong passwords:** 5 in a row lock that name from that device for 5 minutes. On Docker Desktop
  for Windows every visitor looks like the same address, so the lock applies to the name for
  everyone; on a Linux server it's per device.
- **Windows firewall:** Docker Desktop's rule ("Docker Desktop Backend") allows any port on networks
  set to **Public**, but only the ports Docker publishes (80, 443 and 1812 here) are listening, so
  that's all it exposes. If you switch the server's network to **Private**, that rule no longer
  applies: add inbound rules for TCP 80, TCP 443 and UDP 1812, or logins and the portal stop working.
- **Router:** change the TP-Link's admin password from the default, keep WPS off, and keep the
  router secret private: anyone with it could ask the login server to check passwords.
- **Backups and the `data` folder** contain password hashes and the certificate's private key.
- **The Cloudflare token** (`letsencrypt/cloudflare.ini`, step 12) can change your domain's DNS
  records. Only the `wifi-certs` container sees it. If it leaks, delete it in Cloudflare and make a new one.
- **Let's Encrypt certificates are logged publicly**, so the name (e.g. `wifi.riomar.dev`) becomes
  visible. That's normal and reveals nothing else.

## Troubleshooting

| Problem | What to check |
|---|---|
| `docker` says it can't connect | Docker isn't running. Start Docker Desktop (Windows) or `sudo systemctl start docker` (Linux). |
| Containers show **Exited** | `docker compose up -d`, then check `docker compose logs`. |
| No setup code | An admin already exists: sign in instead, or use `add-admin` / `reset-admin`. |
| Phones can't open the portal | Firewall (step 7), and use the server's address, not `localhost`. |
| Nobody can join the Wi-Fi | Portal dashboard → **Login server** must say *Running*. Router's RADIUS IP, port 1812 and secret must match (step 8). |
| One person can't join | Their page: enabled, not expired, password correct? **Recent connections** shows whether the login server saw the attempt and refused it. |
| Wrong ID typed on a phone | IDs are lowercase; phones often capitalise the first letter. |
| Certificate: "Not set up" | `letsencrypt/cloudflare.ini` or `letsencrypt/domain` is missing or empty. Check it isn't saved as `.ini.txt`. |
| Certificate: Cloudflare authentication or "zone" error | The token is wrong, expired, or not allowed to edit DNS for that domain. Make a new one (step 12a). |
| Certificate: "rateLimited" | Too many real attempts for that name. Wait (the message says until when); test with `--dry-run`. |
| Offline page, but the server is on | `docker compose ps` shows `wifi-tunnel` Up? `docker compose logs tunnel` should show `Registered tunnel connection`; a token error means `tunnel/token` is wrong. The server needs internet access. |
| Cloudflare "Error 1033" instead of the offline page | The tunnel is down and the Worker isn't deployed, or its route doesn't match the name (step 13c). |
| "Too many redirects" through the tunnel | The tunnel's service URL is `http://proxy:80`; change it to `http://proxy:8081` (step 13b). |
| Android still warns after step 12 | It kept the old settings: forget the network, then choose **Use system certificates** and enter the domain. |
| Need the full login server trace | `docker compose stop radius`, then `docker run --rm -p 1812:1812/udp -v "$PWD/data:/mnt/local:ro" wifi-radius sh -c "sed 's/freeradius -f/freeradius -X/' /start.sh > /tmp/s && sh /tmp/s"`, try a login, Ctrl+C, `docker compose start radius`. |
