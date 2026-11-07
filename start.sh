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

# Admin web page; restarted if it ever exits. It signals FreeRADIUS (PID 1 after exec) to reload users.
(while true; do python3 /portal.py; echo "portal exited, restarting" >&2; sleep 2; done) &

exec freeradius -f
