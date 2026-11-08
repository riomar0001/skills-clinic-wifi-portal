# Using the portal

Everyday use once [setup](SETUP.md) is done. For backups, moving the server and troubleshooting, see
[Maintenance](MAINTENANCE.md).

The portal is at `http://<server address>` (e.g. `http://192.168.1.101`), or `https://wifi.riomar.dev`
with the Let's Encrypt certificate. Admins and Wi-Fi users sign in on the **same page**: admins land
in the admin portal, students and faculty in **My Wi-Fi**. Five wrong passwords lock a name for five
minutes.

## Managing Wi-Fi users

### Add one person

Portal → **Wi-Fi users → Add Wi-Fi user**:

- **Student ID / Faculty ID**: their Wi-Fi username (lowercase letters, digits, `.`, `-`, `_`).
- **First name**, **last name**, and **UMindanao email** (must end in `@umindanao.edu.ph`; each
  email can belong to only one person).
- **Password**: **Generate** makes an easy-to-type one, or type your own (8-64 plain keyboard
  characters).
- **Access expires**: **Never**, a length from **1 hour to 90 days** (type to search, e.g. `6h`,
  `2w`, `30`), or an exact date and time. After that moment the Wi-Fi refuses the login, even if the
  portal is stopped.
- **Device limit**: how many devices may use the account (default 2).

Pass the ID and password on: the password is shown only once.

From the server's command line instead (it asks for the password, so it isn't saved in history):

```bash
docker exec -it wifi-portal python -m app.cli add-wifi-user --id 123456 --first Juan --last "Dela Cruz" --email j.delacruz.123456@umindanao.edu.ph
```

### Add many people from a CSV file

1. **Wi-Fi users → Import CSV.** Click **Template** for a sample file, or use your own class list.
2. The first row names the columns: **Student ID** (or *Faculty ID*, *ID*), **First Name**,
   **Last Name**, **UMindanao Email**, and optionally **Password**. Order doesn't matter and extra
   columns are ignored. Leave Password empty to have one made up.
   In Excel use **File → Save As → CSV UTF-8**. Up to 1000 people and 1 MB per file.
3. Choose the **expiry** and **device limit** for everyone in the file.
4. **Check file.** Nothing is added yet. Rows with problems (wrong email domain, an ID that already
   exists, the same person twice, a short password) are listed with their line number. Fix them in
   the file and choose it again. **Nobody is added until every row is valid.**
5. **Add N users**, then **Download passwords (CSV)**. The passwords are shown only this once; share
   each one with its owner only, and delete the downloaded file when done.

### Access requests

People without an account can ask for one: **Request Wi-Fi access** on the sign-in page. They
enter their Student/Faculty ID, name, UMindanao email and the **Wi-Fi password they want**.
Nothing is granted until an admin approves.

1. New requests show as a number next to **Access requests** in the sidebar, and on the dashboard.
2. **Access requests → Approve**: choose the **expiry** and **device limit**, then **Approve**. The
   account is created with the password they chose; nobody else ever sees it. They can join the
   Wi-Fi and sign in to My Wi-Fi right away.
3. Or **Reject**. They can send a new request.

While a request waits, signing in with the requested password says it's waiting for an admin.
Unanswered requests are removed after 30 days. Requests for an ID or email that already has an
account are refused, so people can't take over someone's account this way.

### Change someone's account

Open **Wi-Fi users**, search by name, ID or email, and click the person. On their page:

| To | Do this |
|---|---|
| Fix their name, email or note | **Details**, then **Save changes**. The note is only for admins. |
| Change their **Student/Faculty ID** | Edit the ID in **Details** and save. It is also their Wi-Fi username, so their devices need the new ID to join; the old ID stops working at once. Their connection history moves to the new ID. |
| Block them right away | Turn off **Wi-Fi access**. Devices already connected stay on until they reconnect. |
| Give access for a limited time | **Expires → Set/Change**: 1 hour to 90 days, or an exact date and time. **Never** removes the limit. |
| Replace a forgotten password | **Reset password**. The new one is shown once. |
| Remove them for good | **Delete user**. |
| See if their phone is reaching the Wi-Fi | **Recent connections**: each attempt, accepted or refused, with the device's address. |
| Limit how many devices they use | **Device limit**: no limit, or 1 to 10. |
| Let them switch to a new phone | **Devices → Remove** the old one. The next new device to join takes its place. |
| Help them join quickly | Show or print **Join with a QR code** (see [Joining the Wi-Fi](#joining-the-wi-fi)). |

The list's **Active / Expired / Disabled** tabs and the dashboard counts show who can join right now.
**Activity** records who changed what.

### How the device limit works

- The first devices to join with an account are **registered**, up to the limit. The **Devices**
  card shows them with when each was first and last seen.
- Once the limit is reached, a different device is **refused**, even with the right password.
  Registered devices keep working.
- Devices are recognized by their Wi-Fi address (MAC). Most phones use a **different private address
  for each network**, which stays the same for this Wi-Fi, so that's fine. If a phone is set to
  change its address every time it joins, it counts as a new device; turn that off for this network
  (Android: *Privacy → Use device MAC* or *Per-network MAC*; iPhone: *Private Wi-Fi Address → Fixed*).
- The limit applies within about 5 seconds of a new device joining. Lowering the limit doesn't remove
  registered devices; remove the extra ones yourself.

## Joining the Wi-Fi

The network is **CCE Skills Clinic WiFi**. Username = Student/Faculty ID (lowercase: phones often
capitalise the first letter), password = their Wi-Fi password.

| Device | How |
|---|---|
| iPhone / iPad / Mac | Enter the ID and password, then tap **Trust**. |
| Windows | Enter the ID and password, then **Connect** at the certificate prompt. |
| Android 13+ | EAP **PEAP**, Phase 2 **MSCHAPV2**, CA certificate **Trust on first use**, Identity = ID. Domain, if asked: `wifi.skillsclinic.local`. |
| Android, with the Let's Encrypt certificate | EAP **PEAP**, Phase 2 **MSCHAPV2**, CA certificate **Use system certificates**, Domain **wifi.riomar.dev**, Identity = ID. |
| Older Android | Choose **Don't validate**, or install `ca.der` (portal → **Server**) first. |

**The certificate question:** devices ask once to trust the login server's certificate. Tell people to
check the name first: **wifi.skillsclinic.local** (or `wifi.riomar.dev` with Let's Encrypt). A
different name may mean someone is faking the network.

**QR code:** each Wi-Fi user's page, and their My Wi-Fi page, has **Join with a QR code**. Scanning it
fills in the network, PEAP / MSCHAPV2 and their ID; they type the password (it's never in the code).
It works on many Android phones. iPhones ignore Wi-Fi QR codes for this kind of network, so iPhone
users join from **Settings → Wi-Fi**.

## My Wi-Fi (for students and faculty)

Share the portal address. People sign in with their **Student/Faculty ID** and **Wi-Fi password** on
the same page admins use, and can:

- see whether their access is active, when it ends, and when they last connected;
- scan their **Wi-Fi QR code** with another phone to join with their ID filled in;
- update their first name, last name and UMindanao email (not their ID);
- see their **connection history** (last 90 days) and their registered **devices**;
- **change their password**. This is optional, never required. The page warns that their device may
  drop off the Wi-Fi and will need the new password, and asks them to confirm.

Disabled accounts can't sign in. Expired accounts can sign in to see why, but can't change their
password. A Wi-Fi user's sign-in never opens admin pages.

## Admins

### Add or remove admins

- In the portal: **Admins → Add admin**. Use strong passwords (at least 10 characters).
- Or: `docker exec -it wifi-portal python -m app.cli add-admin <username>`

Change your own password from the user menu (bottom left) → **Change password**.

### Make a Wi-Fi user an admin

On their page (**Wi-Fi users** → the person) → **Admin access → Make admin**. Keep or type an admin
password (at least 10 characters), then **Make admin**, and give them the password shown: it isn't
shown again. They get an admin account with the same ID:

- Their **admin password** opens the admin portal; their **Wi-Fi password** still opens My Wi-Fi and
  their devices keep working.
- If they later change their admin password, their Wi-Fi password changes to match
  ([below](#an-admin-who-also-uses-the-wi-fi)).
- To take admin access away, remove them on the **Admins** page; their Wi-Fi account stays. Changing
  their Student/Faculty ID or deleting their Wi-Fi account doesn't change the admin account.

### Forgot an admin password

On the server:

```bash
docker exec -it wifi-portal python -m app.cli list-admins
docker exec -it wifi-portal python -m app.cli reset-admin <username>
```

That admin is signed out everywhere and uses the new password from then on.

### An admin who also uses the Wi-Fi

Admins and Wi-Fi users sign in on the same page, and **admin accounts are checked first**. If an admin
account and a Wi-Fi account share the same name (for example your Student ID):

- **Changing the admin password changes the Wi-Fi password too** (from **Change password**, or with
  `reset-admin`), so one password works for both. It must then also be a valid Wi-Fi password:
  8-64 plain keyboard characters. Your devices ask for the new password the next time they join.
- **Same password:** signing in always opens the admin portal. You can still see your Wi-Fi account
  there under **Wi-Fi users**, but not My Wi-Fi.
- **Different passwords** (only if the Wi-Fi password is reset separately afterwards): the admin
  password opens the admin portal, the Wi-Fi password opens My Wi-Fi.

The Wi-Fi itself only uses the Wi-Fi account and password. Changing a Wi-Fi password never changes the
admin password.

## The Server page

Portal → **Server** shows the login server's certificate, the router settings, the **router secret**
(asks for your password again), and a database **backup** download
([Backups](MAINTENANCE.md#backups)).
