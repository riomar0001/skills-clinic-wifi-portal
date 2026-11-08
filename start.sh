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
(
    last=$(md5sum "$src/users" | cut -d' ' -f1)
    while sleep 2; do
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
