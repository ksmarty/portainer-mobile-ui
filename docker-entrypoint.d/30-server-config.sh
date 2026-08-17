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

    # The service worker and manifest must never be cached: a stale sw.js is
    # the #1 reason installed PWAs don't pick up new versions.
    location = /sw.js {
        add_header Cache-Control "no-cache";
        try_files /sw.js =404;
    }
    location = /manifest.json {
        add_header Cache-Control "no-cache";
        try_files /manifest.json =404;
    }
EOF

if [ -n "$PORTAINER_URL" ]; then
    cat >> "$CONF" <<EOF
    # Optional reverse proxy: forwards /api/* to the configured Portainer.
    # Host is forwarded as the upstream host so routing at the other end
    # lands on Portainer — forwarding the app's own Host header would loop
    # the request straight back into this container.
    location /api/ {
        proxy_pass ${PORTAINER_URL%/};
        proxy_set_header Host \$proxy_host;
        proxy_ssl_server_name on;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
EOF

    # Tell the frontend that /api is proxied so the Connect screen can
    # auto-fill the app's own URL (same-origin) instead of the Portainer URL.
    if [ -f /usr/share/nginx/html/index.html ]; then
        sed -i 's#</head>#<script>window.__PM_PROXY__=1</script></head>#' /usr/share/nginx/html/index.html
    fi
fi

cat >> "$CONF" <<'EOF'
}
EOF

echo "[entrypoint] generated $CONF (PORTAINER_URL=$PORTAINER_URL)"
