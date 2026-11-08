#!/bin/sh
# FreeRADIUS refuses world-writable config, and Windows bind mounts look world-writable,
# so copy the mounted data folder into the container with tight permissions first.
set -eu

src=/mnt/local
dst=/etc/raddb/local

# users may be empty (nobody can log in yet); the others must have content.
for f in clients.conf certs/server.pem certs/ca.pem users; do
    if [ ! -e "$src/$f" ] || { [ "$f" != users ] && [ ! -s "$src/$f" ]; }; then
        echo "Missing $src/$f - run setup.ps1 first." >&2
        exit 1
    fi
done

rm -rf "$dst"
mkdir -p "$dst"
cp -r "$src/." "$dst/"

# A publicly trusted certificate from the certs container (data/letsencrypt), when there is a sound one;
# otherwise the self-made one from setup. A broken file must never stop logins, so it's checked first.
le="$src/letsencrypt/server.pem"
letsencrypt_ok() {
    [ -s "$le" ] || return 1
    key=$(openssl pkey -in "$le" -pubout 2>/dev/null) || return 1
    crt=$(openssl x509 -in "$le" -noout -pubkey 2>/dev/null) || return 1
    [ "$key" = "$crt" ] && openssl x509 -in "$le" -noout -checkend 0 >/dev/null 2>&1
}
if letsencrypt_ok; then
    cp "$le" "$dst/certs/server.pem"
    echo "Using the Let's Encrypt certificate: $(openssl x509 -in "$le" -noout -subject -enddate | tr '\n' ' ')"
elif [ -e "$le" ]; then
    echo "data/letsencrypt/server.pem is invalid or expired; using the self-made certificate." >&2
fi
chown -R freerad:freerad "$dst"
chmod -R u=rwX,g=rX,o= "$dst"

# Login history (wifi-events.conf), on a volume the portal reads. Readable by others: no secrets in it.
events=/var/log/wifi-events
events_max_bytes=10485760
mkdir -p "$events"
touch "$events/auth.log"
chown freerad:freerad "$events" "$events/auth.log"
chmod 755 "$events"
chmod 644 "$events/auth.log"

# The portal rewrites data/users when admins change Wi-Fi users; reload it when it changes.
# Polling, because file-change events don't cross Docker Desktop's Windows folder mounts.
# A renewed certificate needs a fresh start: stop FreeRADIUS and Docker's restart policy brings it back
# (a few seconds; connected devices stay on). Only for a sound new file, or when the file is removed.
fingerprint() { md5sum "$le" 2>/dev/null | cut -d' ' -f1; }
(
    last=$(md5sum "$src/users" | cut -d' ' -f1)
    cert_last=$(fingerprint)
    while sleep 2; do
        cert_now=$(fingerprint)
        if [ "$cert_now" != "$cert_last" ]; then
            cert_last=$cert_now
            if { [ -z "$cert_now" ] || letsencrypt_ok; } && [ "$(cat /proc/1/comm)" = freeradius ]; then
                echo "The certificate changed; restarting the login server to use it."
                kill -TERM 1
            elif [ -n "$cert_now" ]; then
                echo "New data/letsencrypt/server.pem is invalid or expired; keeping the current certificate." >&2
            fi
        fi
        # Cap the history file; the portal has already imported it and notices the truncation.
        size=$(stat -c %s "$events/auth.log" 2>/dev/null || echo 0)
        if [ "$size" -gt "$events_max_bytes" ]; then
            : > "$events/auth.log"
        fi
        now=$(md5sum "$src/users" 2>/dev/null | cut -d' ' -f1) || continue
        if [ -n "$now" ] && [ "$now" != "$last" ]; then
            /reload-users.sh && last=$now
        fi
    done
) &

exec freeradius -f
