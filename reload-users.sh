#!/bin/sh
# Copy the saved user list (Windows folder, looks world-writable) to where FreeRADIUS reads it,
# with permissions it accepts, then tell FreeRADIUS (PID 1) to re-read it.
set -eu
tmp=/etc/raddb/local/.users.tmp
cp /mnt/local/users "$tmp"
chown freerad:freerad "$tmp"
chmod 640 "$tmp"
mv -f "$tmp" /etc/raddb/local/users
kill -HUP 1
