# Skills Clinic Wi-Fi: one login per person

The TL-WR840N switches its Wi-Fi to **WPA2-Enterprise**. When someone joins, their device asks
for a **username and password**. The router checks it with the login server (FreeRADIUS)
that runs in Docker on this PC.

```
phone ──Wi-Fi──> TL-WR840N ──WAN port──> modem (192.168.0.1) <──Ethernet── this PC
                 192.168.0.83   "is ana / ****** ok?"  ──UDP 1812──>   192.168.0.60
                                                                       (wifi-radius container)
```

**This PC must stay on, signed in, and running Docker Desktop.** If it is off, nobody can join
the Wi-Fi. Devices already connected stay connected.

## Files

| File | What it is |
|---|---|
| `setup.ps1` | One-time setup: certificate, router secret, starts the server. Safe to re-run. |
| `http://localhost:8080` | Admin page: add and remove people, see the certificate. Opens only on this PC. |
| `users.ps1` | The same as the admin page, from PowerShell. |
| `data/clients.conf` | The **router secret** (`secret = ...`). Keep it private. |
| `data/users` | Usernames and password hashes (no plain passwords). |
| `data/certs/` | The server certificate, valid until 2036. **Don't delete it**, or every device has to accept a new certificate. |
| `Dockerfile`, `start.sh`, `compose.yaml`, `portal.py`, `reload-users.sh` | The login server container and admin page. |

Back up the `data` folder. It holds everything.

## Managing people

Open **http://localhost:8080** in a browser on this PC. Add someone with a username and
password, or click **Remove**. Changes apply right away, with no restart.

The page only opens on this PC. Other devices on the network can't reach it.

Or, from PowerShell in this folder:

```powershell
.\users.ps1 add ana         # asks for ana's password (8-64 characters)
.\users.ps1 list
.\users.ps1 remove ana      # takes effect the next time ana's device connects
```

Usernames are lowercase. Tell people to type their username in lowercase, since phones
often capitalise the first letter. To change a password, remove the person and add them again.

## Router setup (once)

In `http://192.168.1.1`:

1. **WPS → Disable WPS.** Enterprise mode doesn't work with WPS on.
2. **Wireless → Wireless Security → WPA/WPA2 - Enterprise**
   - Version: **WPA2**, Encryption: **AES**
   - RADIUS Server IP: **192.168.0.60**
   - RADIUS Server Port: **1812**
   - RADIUS Server Password: the `secret =` value from `data/clients.conf`
   - Save.

Every device currently on the Wi-Fi disconnects and has to rejoin with a username and password.

**Keep the addresses fixed.** The router finds the server at 192.168.0.60, and both this PC and
the router's WAN side get their addresses from the modem. In the modem's DHCP settings, reserve
**192.168.0.60** for this PC (MAC `E4-A8-DF-BD-85-C9`) and **192.168.0.83** for the router
(WAN MAC `60:83:E7:E3:B1:BB`). If the PC's address changes, logins stop working until you fix it.

## Joining from a device

Network `TP-Link_B1BA`:

- **iPhone / iPad / Mac:** enter username and password, then tap **Trust** on the certificate.
- **Windows:** enter username and password, then click **Connect** on the certificate prompt.
- **Android 13+:** EAP method **PEAP**, Phase 2 **MSCHAPV2**, CA certificate **Trust on first use**
  ("Use system certificates" won't work), Identity = username, Password = password. Leave
  "Anonymous identity" blank. Domain, if asked: `wifi.skillsclinic.local`.
- **Older Android:** if "Trust on first use" isn't offered, pick **Don't validate**. If that isn't
  offered either, install `data/certs/ca.der` as a Wi-Fi certificate first.

## The certificate warning

The first time a device joins, it shows a certificate warning, because the certificate was
made here rather than bought from a public authority. This is normal for this kind of Wi-Fi.
Each device accepts it **once**, and the certificate stays the same until 2036.

Before tapping **Trust**, check that the certificate name is **wifi.skillsclinic.local**. The
admin page shows that name and the SHA-256 fingerprint, so you can share them with people.
If a device shows a different name, don't trust it: someone may be faking the network.

To avoid the warning entirely, install `ca.der` (download it from the admin page) on the
device before joining. On Android: Settings → Security → Install a certificate → **Wi-Fi
certificate**, then pick it as the CA certificate.

## Keep it running

- Docker Desktop → Settings → General → **Start Docker Desktop when you sign in**.
- Windows → Power settings → set sleep to **Never** when plugged in.
- The container restarts on its own after a crash or a Docker restart.

## If logins fail

```powershell
docker ps --filter name=wifi-radius        # should say "Up"
.\setup.ps1                                # starts it again; keeps existing data
```

For details, run a debug copy (stop the normal one first):

```powershell
docker compose stop radius
docker run --rm -p 1812:1812/udp -v "${PWD}\data:/mnt/local:ro" wifi-radius sh -c "sed 's/freeradius -f/freeradius -X/' /start.sh > /tmp/s && sh /tmp/s"
# try to connect a phone, read the output, Ctrl+C, then:
docker compose start radius
```
