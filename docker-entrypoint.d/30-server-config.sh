#!/bin/sh
# Generates /etc/nginx/conf.d/default.conf at container start.
# Runs automatically through the official nginx image's /docker-entrypoint.d.
#
# If PORTAINER_URL is set (e.g. https://portainer.example.com), an /api/ proxy
# is added so the UI can talk to Portainer same-origin (avoids CORS). When
# unset, the container is a plain static file server and you enter the full
# Portainer URL + API key in the UI instead.

set -e

CONF=/etc/nginx/conf.d/default.conf

cat > "$CONF" <<'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback for client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Hashed build assets: cache forever
    location /assets/ {
        try_files $uri =404;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
EOF

if [ -n "$PORTAINER_URL" ]; then
    cat >> "$CONF" <<EOF
    # Optional reverse proxy: forwards /api/* to the configured Portainer
    location /api/ {
        proxy_pass ${PORTAINER_URL%/};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
EOF
fi

cat >> "$CONF" <<'EOF'
}
EOF

echo "[entrypoint] generated $CONF (PORTAINER_URL=$PORTAINER_URL)"
