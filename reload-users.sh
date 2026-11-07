#!/bin/sh
# Copy the user list (Windows folder, looks world-writable) to where FreeRADIUS reads it,
# with permissions it accepts, then tell FreeRADIUS (PID 1) to re-read it.
set -eu
tmp=/etc/raddb/local/.users.tmp
cp /mnt/local/users "$tmp"
chown freerad:freerad "$tmp"
chmod 640 "$tmp"
mv -f "$tmp" /etc/raddb/local/users

# Only signal FreeRADIUS itself; during startup PID 1 is still start.sh, which reads the new copy anyway.
if [ "$(cat /proc/1/comm)" = freeradius ]; then
    kill -HUP 1
    echo "Reloaded Wi-Fi users"
fi
