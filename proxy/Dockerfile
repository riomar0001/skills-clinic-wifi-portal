# HTTPS front for the portal, using the login server's Let's Encrypt certificate when there is one.
FROM nginx:1.28.0-alpine

RUN apk add --no-cache openssl \
 && rm -f /etc/nginx/conf.d/*.conf
COPY start.sh /start.sh
RUN sed -i 's/\r$//' /start.sh && chmod 755 /start.sh

ENTRYPOINT ["/start.sh"]
