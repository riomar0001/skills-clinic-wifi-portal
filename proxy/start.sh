#!/bin/sh
# Front door for the portal. With a sound Let's Encrypt certificate (data/letsencrypt, from the certs
# container): HTTPS on 443, and port 80 redirects there. Without one: plain HTTP on 80, as before.
# Switches by itself when the certificate is renewed, removed or expires.
set -eu

le=/mnt/letsencrypt/server.pem   # private key + chain; read-only mount
tls=/etc/nginx/tls               # private copy, so a half-written renewal is never served
conf=/etc/nginx/conf.d/default.conf

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S') $*"; }

# Same rule as the login server's start.sh: key matches the certificate and it hasn't expired.
cert_ok() {
    [ -s "$le" ] || return 1
    key=$(openssl pkey -in "$le" -pubout 2>/dev/null) || return 1
    crt=$(openssl x509 -in "$le" -noout -pubkey 2>/dev/null) || return 1
    [ "$key" = "$crt" ] && openssl x509 -in "$le" -noout -checkend 0 >/dev/null 2>&1
}

# "https <fingerprint>" or "http": what the config should be right now.
wanted() {
    if cert_ok; then echo "https $(md5sum "$le" | cut -d' ' -f1)"; else echo http; fi
}

# $1: nginx variable holding the visitor's address; $2: the scheme they used.
proxy_block() {
    cat <<EOF
    client_max_body_size 3m;   # the portal itself limits bodies (2 MB for CSV import)
    location / {
        proxy_pass http://portal:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For $1;   # replaced, never appended: can't be spoofed
        proxy_set_header X-Forwarded-Proto $2;
        proxy_read_timeout 60s;
    }
EOF
}

# Entrance for the optional Cloudflare Tunnel (tunnel container). Port 8081 isn't published, so only
# containers reach it. The visitor's address comes from CF-Connecting-IP, which Cloudflare's edge sets
# itself; trusting X-Forwarded-For here would let anyone on the internet dodge the login lockout.
tunnel_server() {
    echo 'map $http_cf_connecting_ip $tunnel_client { "" $remote_addr; default $http_cf_connecting_ip; }'
    echo "server {"
    echo "    listen 8081; server_name _;"
    echo '    if ($http_x_forwarded_proto = "http") { return 301 https://$host$request_uri; }'
    proxy_block '$tunnel_client' https
    echo "}"
}

# Writes the config for the current state and checks it before it is used.
configure() {
    state=$1
    mkdir -p "$tls"
    if [ "${state%% *}" = https ]; then
        domain=$(openssl x509 -in "$le" -noout -subject -nameopt RFC2253 | sed -n 's/^subject=.*CN=\([^,]*\).*/\1/p')
        echo "$domain" | grep -Eq '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' \
            || { log "Certificate name '$domain' looks wrong; serving plain HTTP."; state=http; }
    fi
    if [ "${state%% *}" = https ]; then
        (umask 077 && cp "$le" "$tls/server.pem.new") && mv -f "$tls/server.pem.new" "$tls/server.pem"
        {
            echo "server { listen 80 default_server; server_name _; return 301 https://$domain\$request_uri; }"
            echo "server {"
            echo "    listen 443 ssl default_server; server_name _;"
            echo "    ssl_certificate $tls/server.pem; ssl_certificate_key $tls/server.pem;"
            echo "    ssl_protocols TLSv1.2 TLSv1.3;"
            echo "    ssl_session_cache shared:tls:1m;"
            proxy_block '$remote_addr' '$scheme'
            echo "}"
            tunnel_server
        } > "$conf.new"
        log "Serving https://$domain (port 80 redirects there)."
    else
        rm -f "$tls/server.pem"
        {
            echo "server {"; echo "    listen 80 default_server; server_name _;"; proxy_block '$remote_addr' '$scheme'; echo "}"
            tunnel_server
        } > "$conf.new"
        log "No usable Let's Encrypt certificate; serving plain HTTP on port 80."
    fi
    mv -f "$conf.new" "$conf"
    nginx -t -q
}

current=$(wanted)
configure "$current"

# Polling, because file-change events don't cross Docker Desktop's Windows folder mounts.
(
    while sleep 10; do
        now=$(wanted)
        [ "$now" = "$current" ] && continue
        if configure "$now" && nginx -s reload; then
            current=$now
        else
            log "Couldn't switch the configuration; will retry."
        fi
    done
) &

exec nginx -g 'daemon off;'
