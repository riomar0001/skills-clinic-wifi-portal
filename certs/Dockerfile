# Gets and renews a publicly trusted certificate for the login server from Let's Encrypt,
# proving ownership of the domain with a temporary DNS record made through Cloudflare's API.
FROM certbot/dns-cloudflare:v5.9.0

COPY renew.sh /usr/local/bin/wifi-certs
RUN sed -i 's/\r$//' /usr/local/bin/wifi-certs && chmod 755 /usr/local/bin/wifi-certs

ENTRYPOINT ["/usr/local/bin/wifi-certs"]
