# Maintenance

Keeping the server running after [setup](SETUP.md): commands, backups, updates, moving, changing the
address or router, security and troubleshooting. Run commands in the project folder.

## Everyday commands

| What | Command |
|---|---|
| Status | `docker compose ps` |
| Portal log | `docker compose logs portal --tail 50` |
| Login server log | `docker compose logs radius --tail 50` |
| Certificate log (setup step 11) | `docker compose logs certs --tail 50` |
| Tunnel log (setup step 12) | `docker compose logs tunnel --tail 50` |
| Restart everything | `docker compose restart` |
| Stop everything | `docker compose stop` |
| Start again | `docker compose start` (or run setup again) |

**The server must stay on with Docker running.** If it's off, nobody new can join the Wi-Fi; devices
already connected stay connected.

## Updating to a new version

```bash
git pull
```

Then run setup again (`.\setup.ps1` or `sh setup.sh`). It rebuilds the containers and keeps all data,
the certificate and the router secret.

## Backups

Two things hold everything:

1. **The `data` folder**: certificate, keys, router secret. Copy it somewhere safe once; it rarely
   changes. With setup step 11, also keep the `letsencrypt` folder (the Cloudflare token), or just make
   a new token. With step 12, keep the `tunnel` folder too.
2. **The portal database**: admins, Wi-Fi users, history. Download it from the portal:
   **Server → Download backup** (a `.db` file). Do this regularly.

Keep backups private: they contain password hashes and the certificate's private key.

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

1. On the old server: download a database backup, and copy the whole project folder **including
   `data`** (and `letsencrypt` and `tunnel`, if you use setup steps 11 and 12).
2. On the new machine: follow setup steps 2 to 5. Because `data` came along, the certificate and
   router secret stay the same, so phones won't see a new certificate. Skip step 6: the admins come
   back with the database.
3. Restore the database backup (above).
4. If the new machine has a different address, follow
   [Changing the server's address](#changing-the-servers-address).
5. Stop the old one: `docker compose --profile tunnel down` in its project folder. With step 12, a
   tunnel left running on the old machine would get some of the visitors.

## Changing the server's address

The address can change any time (a new network, a new reservation, a move). Nothing in the project
stores it: the login server accepts the router from any address, and the Let's Encrypt certificate is
tied to the name (`wifi.riomar.dev`), not the address. Only these places point to the server:

| Where | What to change | Until you do |
|---|---|---|
| Router (or modem) → **DHCP → Address Reservation** (setup step 2) | Reserve the new address for the server's Ethernet MAC | The address may change again |
| Router → **Wireless Security** (setup step 9), on every router | **RADIUS Server IP** = the new address, then **Save** | Nobody can join the Wi-Fi |
| Cloudflare → your domain → **DNS → Records** (setup step 11c) | Edit the `wifi` record's **IPv4 address**; keep it **DNS only**. Not needed with step 12: the tunnel finds the server by itself | `https://wifi.riomar.dev` doesn't load |

Nothing else changes: no rebuild or setup run, and devices keep their Wi-Fi settings without rejoining
or trusting anything again. Some devices may keep using the old address for a few minutes after a DNS
change, until their cached lookup expires.

**Check afterwards:** the portal's dashboard says the login server is *Running*, a phone can join, and
(without step 12) `nslookup wifi.riomar.dev 1.1.1.1` answers the new address.

If the server now sits behind the router (plugged into its LAN port), only devices on the router's
Wi-Fi or LAN ports can open the portal by its address; devices on the modem's network can't reach it.

## Using another router (or more than one)

Nothing on the server is tied to the TL-WR840N. The router only passes each login to the server and lets
the device on if the server says yes; accounts, passwords, expiry, device limits, history and the QR
code all live on the server. Any router or access point works if its Wi-Fi security menu has
**WPA2-Enterprise** (also called *WPA/WPA2-Enterprise* or *802.1X*) with fields for a **RADIUS server
IP, port and password**. If it only offers *WPA2-Personal*, it won't work.

| Usually works | Usually doesn't |
|---|---|
| Most standalone TP-Link, ASUS and Netgear routers | ISP-supplied modem/routers (often locked down) |
| Business access points: TP-Link Omada, Ubiquiti UniFi, MikroTik, Aruba Instant On, Ruckus, Cisco | Many mesh systems (e.g. TP-Link Deco, eero) |
| WPA3-Enterprise routers (they also offer WPA2-Enterprise) | Travel and pocket routers |

Check the exact model's manual before buying. To set one up:

1. Turn off **WPS** if it has it.
2. Wi-Fi security **WPA2-Enterprise**, encryption **AES**, RADIUS server = the server's address,
   port **1812**, password = the router secret (portal → **Server → Show secret**). Accounting
   (port 1813) isn't used; leave it off or empty.
3. Name the network **CCE Skills Clinic WiFi**, or the QR codes point to the wrong network. To use
   another name, change `WIFI_SSID` in `portal/web/src/lib/wifi.ts` and run setup again.
4. The router must reach the server on **UDP 1812**: put them on the same network, and allow 1812 in
   the server's firewall (setup step 7).

The server already accepts any router that knows the secret, so nothing changes on the server, and
devices that joined before only need to rejoin if the network name changed.

**More than one router**, for example one per room: give them all the same network name, security
settings and RADIUS server. People then move between them with the same login, and the device limit
and history count across all of them. This is also how to serve more people at once: one TL-WR840N
handles roughly 15–25 active devices.

## Turning off the optional extras

### The Let's Encrypt certificate (setup step 11)

```bash
docker compose stop certs
```

Then delete `letsencrypt/cloudflare.ini` and the files in `data/letsencrypt/`. The login server
switches back to the self-made certificate by itself, and devices must forget the network and rejoin.
The portal goes back to `http://<server>` within about 10 seconds; you can then delete the DNS record.
Also delete the token in Cloudflare (**API Tokens → … → Delete**).

### The Cloudflare Tunnel and offline page (setup step 12)

1. `docker compose stop tunnel`, then delete `tunnel/token`.
2. In Cloudflare, delete the Worker (**Workers & Pages → wifi-portal-fallback → Settings → Delete**),
   then the tunnel (**Networks → Connectors → wifi-portal → Delete**).
3. **DNS → Records:** delete the tunnel's `wifi` CNAME record and add the A record from setup step 11c
   again.

## Security notes

- **The portal uses plain HTTP unless setup step 11 is done.** On the Wi-Fi, each person's traffic is
  encrypted by WPA2-Enterprise, but on the wired network a sign-in could be read by someone sniffing
  it. With step 11, the portal is HTTPS-only. Don't publish ports 80/443 to the internet yourself, and
  never publish the portal container's own port 8080: it trusts the proxy's visitor-address headers.
- **With setup step 12 the portal is on the internet** through Cloudflare. Use strong admin
  passwords, and keep the tunnel's service at `http://proxy:8081`. The **tunnel token**
  (`tunnel/token`) lets anyone run your tunnel: if it leaks, delete the tunnel in Cloudflare and make a
  new one.
- **Access requests** come from a public form, so anyone who can open the portal can send one. They
  grant nothing until an admin approves, so check the name and ID before approving. The form is
  limited to 60 requests per address per 10 minutes and 300 waiting requests in total.
- **Wrong passwords:** 5 in a row lock that name from that address for 5 minutes. On Docker Desktop
  for Windows every visitor on the network looks like the same address, so the lock applies to the
  name for everyone; on a Linux server it's per device. Through the tunnel it's per public address.
- **Windows firewall:** Docker Desktop's rule allows any port on networks set to **Public**, but only
  the ports Docker publishes (80, 443 and 1812) are listening, so that's all it exposes.
- **Router:** change the TP-Link's admin password from the default, keep WPS off, and keep the router
  secret private: anyone with it could ask the login server to check passwords.
- **Backups and the `data` folder** contain password hashes and the certificate's private key.
- **The Cloudflare token** (`letsencrypt/cloudflare.ini`) can change your domain's DNS records. Only
  the `wifi-certs` container sees it. If it leaks, delete it in Cloudflare and make a new one.
- **Let's Encrypt certificates are logged publicly**, so the name (e.g. `wifi.riomar.dev`) becomes
  visible. That's normal and reveals nothing else.

## Troubleshooting

| Problem | What to check |
|---|---|
| `docker` says it can't connect | Docker isn't running. Start Docker Desktop (Windows) or `sudo systemctl start docker` (Linux). |
| Containers show **Exited** | Run setup again, then check `docker compose logs`. |
| No setup code | An admin already exists: sign in instead, or use `add-admin` / `reset-admin` ([Admins](USING.md#admins)). |
| Phones can't open the portal | Firewall (setup step 7), and use the server's address, not `localhost`. If the server is behind the router, the phone must be on the router's network. |
| Nobody can join the Wi-Fi | Portal dashboard → **Login server** must say *Running*. The router's RADIUS IP, port 1812 and secret must match (setup step 9). Did the server's address change? See [Changing the server's address](#changing-the-servers-address). |
| One person can't join | Their page: enabled, not expired, password correct, device limit not reached? **Recent connections** shows whether the login server saw the attempt and refused it. |
| Wrong ID typed on a phone | IDs are lowercase; phones often capitalise the first letter. |
| Certificate: "Not set up" | `letsencrypt/cloudflare.ini` or `letsencrypt/domain` is missing or empty. Check it isn't saved as `.ini.txt`. |
| Certificate: Cloudflare authentication or "zone" error | The token is wrong, expired, or not allowed to edit DNS for that domain. Make a new one (setup step 11a). |
| Certificate: "rateLimited" | Too many real attempts for that name. Wait (the message says until when); test with `--dry-run`. |
| Android still warns after setup step 11 | It kept the old settings: forget the network, then choose **Use system certificates** and enter the domain. |
| Offline page, but the server is on | `docker compose ps` shows `wifi-tunnel` Up? `docker compose logs tunnel` should show `Registered tunnel connection`; a token error means `tunnel/token` is wrong. The server needs internet access. |
| Cloudflare "Error 1033" instead of the offline page | The tunnel is down and the Worker isn't deployed, or its route doesn't match the name (setup step 12c). |
| "Too many redirects" through the tunnel | The tunnel's service URL is `http://proxy:80`; change it to `http://proxy:8081` (setup step 12b). |
| Need the full login server trace | `docker compose stop radius`, then `docker run --rm -p 1812:1812/udp -v "$PWD/data:/mnt/local:ro" wifi-radius sh -c "sed 's/freeradius -f/freeradius -X/' /start.sh > /tmp/s && sh /tmp/s"`, try a login, Ctrl+C, `docker compose start radius`. |
