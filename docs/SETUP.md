# Setup guide

How to install the CCE Skills Clinic Wifi Admin Portal with Docker, create the first admin, and
connect the TP-Link router. Works on **Windows** (Docker Desktop) and **Linux** (for example a
Raspberry Pi 4/5 with a 64-bit OS, or any small PC).

When you're done you'll have:

- **wifi-radius**: the login server (FreeRADIUS). The router asks it whether a Wi-Fi username and
  password are right.
- **wifi-portal**: the website at `http://<server>:8080`. Admins manage Wi-Fi users there, and
  students and faculty sign in to **My Wi-Fi** on the same page.

---

## 1. What you need

| | |
|---|---|
| A machine that stays on | Windows 10/11 or Linux, 2 GB RAM is plenty. If it's off, nobody new can join the Wi-Fi. |
| A network cable | The server must be **wired** to the modem or a router LAN port, not on Wi-Fi (once Wi-Fi asks for logins, a server on Wi-Fi couldn't log itself in). |
| The project folder | This repository, including the `data` folder if you're moving an existing install. |
| The TP-Link TL-WR840N | And its admin password, to change its Wi-Fi security later. |

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

Both `wifi-radius` and `wifi-portal` should say **Up**.

## 5. Create the first admin

### Option A: in the browser (recommended)

1. On the server, open **http://localhost:8080**. You're sent to **Create the first admin**.
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

- **Different passwords:** the admin password opens the admin portal, the Wi-Fi password opens My Wi-Fi.
- **Same password:** signing in always opens the admin portal. You can still see your Wi-Fi account
  there under **Wi-Fi users**, but not My Wi-Fi.

Either way, the Wi-Fi itself only uses the Wi-Fi account and password.

## 6. Give the server a fixed address

The router finds the login server by its IP address, so that address must not change.

1. Find the server's address and network adapter MAC:
   - Windows: `ipconfig /all` (look at the **Ethernet** adapter).
   - Linux: `ip -4 addr` and `ip link`.
2. In your **modem's** DHCP settings (or the router's, if the server is plugged into it), add an
   **address reservation** for that MAC address.

If the server's address ever changes, Wi-Fi logins stop until you update **RADIUS Server IP** in the
router (step 8).

## 7. Firewall

The server needs these open:

| Port | From | Why |
|---|---|---|
| UDP **1812** | The TP-Link router | Wi-Fi logins |
| TCP **8080** | The network | The portal (admins and Wi-Fi users) |

- **Windows:** Docker Desktop adds its own firewall rules when it starts. If a phone on the Wi-Fi
  can't open `http://<server>:8080`, allow Docker Desktop in **Windows Security → Firewall → Allow
  an app**.
- **Linux:** Docker opens published ports itself, even past `ufw`. Nothing to add unless another
  firewall sits in front.

Test from another device on the network: open `http://<server address>:8080`. The sign-in page
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
     Identity = ID. Domain, if asked: `wifi.skillsclinic.local`.
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

Share `http://<server address>:8080`. People sign in with their **Student/Faculty ID** and **Wi-Fi
password** on the same page admins use, and can:

- see whether their access is active, when it ends, and when they last connected;
- update their first name, last name and UMindanao email (not their ID);
- see their **connection history** (last 90 days) and their registered **devices**;
- **change their password**. This is optional, never required. The page warns that their device may
  drop off the Wi-Fi and will need the new password, and asks them to confirm.

Disabled accounts can't sign in. Expired accounts can sign in to see why, but can't change their
password. A Wi-Fi user's sign-in never opens admin pages.

---

## Everyday commands

Run these in the project folder.

| What | Command |
|---|---|
| Status | `docker compose ps` |
| Portal log | `docker compose logs portal --tail 50` |
| Login server log | `docker compose logs radius --tail 50` |
| Restart both | `docker compose restart` |
| Stop both | `docker compose stop` |
| Start again | `docker compose start` (or run setup again) |
| Update to a new version | `git pull`, then run setup again (it rebuilds and keeps all data) |

## Backups

Two things hold everything:

1. **The `data` folder**: certificate, keys, router secret. Copy it somewhere safe once; it rarely changes.
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

1. On the old server: download a database backup, and copy the whole project folder **including `data`**.
2. On the new machine: install Docker (step 2), put the folder there, and run setup (step 4).
   Because `data` came along, the certificate and router secret stay the same, so phones won't see
   a new certificate.
3. Restore the database backup (above).
4. Give the new machine a fixed address (step 6) and change **RADIUS Server IP** in the router (step 8).
5. Stop the old one: `docker compose down` in its project folder.

## Security notes

- **The portal uses plain HTTP.** On the Wi-Fi, each person's traffic is encrypted by WPA2-Enterprise,
  but on the wired network a sign-in could be read by someone sniffing it. Keep the server on a
  network only staff can plug into, and don't publish port 8080 to the internet.
- **Wrong passwords:** 5 in a row lock that name from that device for 5 minutes. On Docker Desktop
  for Windows every visitor looks like the same address, so the lock applies to the name for
  everyone; on a Linux server it's per device.
- **Windows firewall:** Docker Desktop's rule ("Docker Desktop Backend") allows any port on networks
  set to **Public**, but only the ports Docker publishes (8080 and 1812 here) are listening, so
  that's all it exposes. If you switch the server's network to **Private**, that rule no longer
  applies: add inbound rules for TCP 8080 and UDP 1812, or logins and the portal stop working.
- **Router:** change the TP-Link's admin password from the default, keep WPS off, and keep the
  router secret private: anyone with it could ask the login server to check passwords.
- **Backups and the `data` folder** contain password hashes and the certificate's private key.

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
| Need the full login server trace | `docker compose stop radius`, then `docker run --rm -p 1812:1812/udp -v "$PWD/data:/mnt/local:ro" wifi-radius sh -c "sed 's/freeradius -f/freeradius -X/' /start.sh > /tmp/s && sh /tmp/s"`, try a login, Ctrl+C, `docker compose start radius`. |
