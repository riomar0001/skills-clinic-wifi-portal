FROM freeradius/freeradius-server:3.2.8

# Read clients, users and certificates from /etc/raddb/local (copied in by start.sh),
# and offer PEAP first: it is what phones and laptops use for username + password Wi-Fi.
RUN set -eu; \
    sed -i 's|^certdir = .*|certdir = /etc/raddb/local/certs|; s|^cadir   = .*|cadir   = /etc/raddb/local/certs|; s|^\$INCLUDE clients.conf|$INCLUDE /etc/raddb/local/clients.conf|' /etc/raddb/radiusd.conf; \
    sed -i 's|^\(\s*filename = \).*|\1/etc/raddb/local/users|' /etc/raddb/mods-available/files; \
    sed -i '0,/default_eap_type = md5/s//default_eap_type = peap/' /etc/raddb/mods-available/eap; \
    grep -q '^certdir = /etc/raddb/local/certs' /etc/raddb/radiusd.conf; \
    grep -q 'INCLUDE /etc/raddb/local/clients.conf' /etc/raddb/radiusd.conf; \
    grep -q 'filename = /etc/raddb/local/users' /etc/raddb/mods-available/files; \
    grep -q 'default_eap_type = peap' /etc/raddb/mods-available/eap

COPY start.sh /start.sh
COPY reload-users.sh /reload-users.sh
RUN sed -i 's/\r$//' /start.sh /reload-users.sh && chmod 755 /start.sh /reload-users.sh

CMD ["/start.sh"]
