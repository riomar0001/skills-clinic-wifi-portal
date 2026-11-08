#!/bin/sh
# Keeps data/letsencrypt/server.pem (key + chain) and server.crt (chain) current for the login server.
#
#   wifi-certs                     run forever: get or renew the certificate, then check again later
#   wifi-certs once [certbot args] one attempt, e.g. "once --dry-run" to test the token without a real certificate
#
# Off until letsencrypt/cloudflare.ini (the API token) and letsencrypt/domain exist; it just waits.
set -eu

config=/etc/wifi-certs        # ./letsencrypt, read-only: token and domain
out=/out                      # ./data/letsencrypt: what the login server and portal read
state=/etc/letsencrypt        # certbot's own files (Docker volume)
check_every=43200             # 12 hours; certbot only renews in the last 30 days
retry_after=3600              # after a failure; stays well under Let's Encrypt's rate limits

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S') $*"; }

read_domain() {
    domain=$(head -n 1 "$config/domain" 2>/dev/null | tr -d ' \r\n' | tr 'A-Z' 'a-z')
    echo "$domain" | grep -Eq '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' || {
        log "letsencrypt/domain must hold one name like wifi.example.com (got '$domain')."
        return 1
    }
}

# Copies the certificate where the login server reads it, only if it changed and is sound,
# so a bad or unchanged result never restarts the login server.
install() {
    live="$state/live/$domain"
    [ -s "$live/privkey.pem" ] && [ -s "$live/fullchain.pem" ] || { log "No certificate files in $live."; return 1; }
    key_pub=$(openssl pkey -in "$live/privkey.pem" -pubout 2>/dev/null) || { log "Unreadable private key."; return 1; }
    cert_pub=$(openssl x509 -in "$live/fullchain.pem" -noout -pubkey 2>/dev/null) || { log "Unreadable certificate."; return 1; }
    [ "$key_pub" = "$cert_pub" ] || { log "Key and certificate don't match; not installing."; return 1; }
    openssl x509 -in "$live/fullchain.pem" -noout -checkhost "$domain" | grep -q 'does match' \
        || { log "Certificate isn't for $domain; not installing."; return 1; }

    mkdir -p "$out"
    cat "$live/privkey.pem" "$live/fullchain.pem" > "$out/.server.pem.tmp"
    cp "$live/fullchain.pem" "$out/.server.crt.tmp"
    if cmp -s "$out/.server.pem.tmp" "$out/server.pem" 2>/dev/null; then
        rm -f "$out/.server.pem.tmp" "$out/.server.crt.tmp"
        return 0
    fi
    chmod 755 "$out"
    chmod 600 "$out/.server.pem.tmp"   # private key: only the login server (root) reads it
    chmod 644 "$out/.server.crt.tmp"   # public: the portal shows it
    mv -f "$out/.server.crt.tmp" "$out/server.crt"   # public part first; the login server watches server.pem
    mv -f "$out/.server.pem.tmp" "$out/server.pem"
    log "Installed the certificate for $domain ($(openssl x509 -in "$out/server.crt" -noout -enddate))."
}

attempt() {
    if [ ! -s "$config/cloudflare.ini" ] || [ ! -s "$config/domain" ]; then
        log "Not set up: put the Cloudflare token in letsencrypt/cloudflare.ini and the name in letsencrypt/domain."
        return 2
    fi
    read_domain || return 1
    # certbot refuses credentials others can read; Windows folder mounts look world-readable.
    (umask 077 && cp "$config/cloudflare.ini" /tmp/cloudflare.ini)
    # RSA: older Android and Windows Wi-Fi clients handle it better than ECDSA.
    certbot certonly --non-interactive --agree-tos --register-unsafely-without-email \
        --dns-cloudflare --dns-cloudflare-credentials /tmp/cloudflare.ini --dns-cloudflare-propagation-seconds 30 \
        --cert-name "$domain" -d "$domain" --key-type rsa --rsa-key-size 2048 --keep-until-expiring \
        --config-dir "$state" --work-dir /tmp/certbot-work --logs-dir /tmp/certbot-logs "$@" \
        || { rm -f /tmp/cloudflare.ini; log "certbot failed (see above)."; return 1; }
    rm -f /tmp/cloudflare.ini
    case " $* " in *" --dry-run "*) log "Dry run worked: the token and domain are fine."; return 0 ;; esac
    install
}

trap 'exit 0' TERM INT

if [ "${1:-}" = once ]; then
    shift
    attempt "$@"
    exit $?
fi

while :; do
    if attempt; then wait_for=$check_every; else wait_for=$retry_after; fi
    sleep "$wait_for" &
    wait $!
done
