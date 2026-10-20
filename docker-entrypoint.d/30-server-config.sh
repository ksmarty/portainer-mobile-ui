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

    # The app shell must always be revalidated so updated builds propagate
    # (through Cloudflare/caches) on the very next navigation.
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
        try_files /index.html =404;
    }
    location = / {
        add_header Cache-Control "no-cache, must-revalidate";
        try_files /index.html =404;
    }

    # Host storage snapshot, regenerated in the background by the entrypoint.
    # Must never be cached: the whole point is that it tracks live disk usage.
    location = /storage.json {
        add_header Cache-Control "no-cache, must-revalidate";
        try_files /storage.json =404;
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
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_buffering off;
    }
EOF

    # Tell the frontend that /api is proxied so the Connect screen can
    # auto-fill the app's own URL (same-origin) instead of the Portainer URL.
    if [ -f /usr/share/nginx/html/index.html ]; then
        sed -i 's#</head>#<script>window.__PM_PROXY__=1</script></head>#' /usr/share/nginx/html/index.html
    fi
fi

# Bake the build version into the page: the app registers the service worker
# with a versioned URL (/sw.js?v=<build>), forcing an update every release.
if [ -f /usr/share/nginx/html/version.json ]; then
    V=$(grep -o '"version":"[^"]*"' /usr/share/nginx/html/version.json | head -1 | cut -d'"' -f4)
    if [ -n "$V" ] && [ -f /usr/share/nginx/html/index.html ]; then
        sed -i "s#</head>#<script>window.__PM_VERSION__='$V'</script></head>#" /usr/share/nginx/html/index.html
    fi
fi

cat >> "$CONF" <<'EOF'
}
EOF

# ---- Host storage snapshot ------------------------------------------------
# Emits /usr/share/nginx/html/storage.json from `df` so the dashboard can show
# the disk that this container (and therefore Portainer, when run on the same
# host) is using. The container root fs is the host's overlay backing store, so
# `df /` reports the main drive; any extra host partitions appear when the host
# root is bind-mounted into /host. Refresh happens on a loop so the numbers
# track live usage without an app rebuild.
STORAGE=/usr/share/nginx/html/storage.json

gen_storage() {
    TMP="${STORAGE}.tmp"
    HOST="$(hostname)"
    NOW="$(date +%s)000"
    { df -kP 2>/dev/null || df -k 2>/dev/null; } | awk -v host="$HOST" -v now="$NOW" '
        function esc(s) { gsub(/\\/, "\\\\", s); gsub(/"/, "\\\"", s); return s }
        BEGIN { printf "{\"generatedAt\":%s,\"host\":\"%s\",\"mounts\":[", now, esc(host); first = 1 }
        NR == 1 { next }
        {
            total = $2 + 0
            if (total <= 0) next
            used = $3 + 0
            avail = $4 + 0
            cap = $5; gsub(/%/, "", cap)
            mount = ""
            for (i = 6; i <= NF; i++) mount = mount (i > 6 ? " " : "") $i
            if (mount == "") next
            if (!first) printf ","
            first = 0
            printf "\n  {\"filesystem\":\"%s\",\"mountpoint\":\"%s\",\"totalBytes\":%d,\"usedBytes\":%d,\"availBytes\":%d,\"usedPercent\":%d}",
                esc($1), esc(mount), total * 1024, used * 1024, avail * 1024, cap + 0
        }
        END { if (!first) printf "\n"; printf "]}"; printf "\n" }
    ' > "$TMP" 2>/dev/null && mv "$TMP" "$STORAGE"
    return 0
}

gen_storage
( while :; do sleep 15; gen_storage; done ) &

echo "[entrypoint] generated $CONF (PORTAINER_URL=$PORTAINER_URL)"
