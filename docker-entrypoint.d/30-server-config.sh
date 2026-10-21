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
#
# Sizes are emitted in KiB, never in bytes: busybox awk (the awk in the alpine
# nginx image) prints %d through a 32-bit int, so `kB * 1024` overflowed at
# ~2 GB and produced negative byte counts — which the UI rendered as
# "NaN undefined". KiB stays well inside the range for any real disk, and the
# frontend multiplies by 1024 in JS where the numbers are doubles.
STORAGE=/usr/share/nginx/html/storage.json

# Map a df filesystem to its kernel block-device name. df reports whatever the
# mount table says — /dev/nvme0n1p2, /dev/mapper/vg-lv, /dev/md127, or nothing
# at all for overlay/tmpfs. Only real block devices have a physical disk.
block_name() {
    _fs=$1
    _base=$(basename "$_fs")
    # Fast path: the node name is the kernel name (sda1, nvme0n1p2, md127).
    if [ -e "/sys/class/block/$_base" ]; then
        echo "$_base"
        return
    fi
    # /dev/mapper/<name> is a device-mapper alias; sysfs stores the same name
    # (with '-' escaped as '--') under dm/name for the dm-N device.
    case "$_fs" in
        /dev/mapper/*)
            for _d in /sys/class/block/dm-*; do
                [ -e "$_d/dm/name" ] || continue
                if [ "$(cat "$_d/dm/name" 2>/dev/null)" = "$_base" ]; then
                    basename "$_d"
                    return
                fi
            done
            ;;
    esac
    echo ""
}

# Resolve a kernel block device to the physical disk(s) behind it, so partitions,
# LVM volumes and RAID arrays on the same drive can be grouped:
#   nvme0n1p2                      -> nvme0n1
#   dm-0 (over nvme0n1p3)          -> nvme0n1   (walks /sys/class/block/*/slaves)
#   md127 (sda1 + sdb1)            -> sda+sdb
phys_disk() {
    _queue=$1
    _out=""
    _i=0
    while [ -n "$_queue" ]; do
        _i=$((_i + 1))
        [ "$_i" -gt 32 ] && break
        set -- $_queue
        _q=$1
        shift
        _queue=$*
        _dir="/sys/class/block/$_q"
        [ -e "$_dir" ] || continue
        # Logical devices (dm/md/loop) list their backing devices as slaves:
        # walk down to them until a leaf is reached.
        if [ -d "$_dir/slaves" ] && [ -n "$(ls -A "$_dir/slaves" 2>/dev/null)" ]; then
            for _sl in $(ls "$_dir/slaves"); do
                _queue="$_queue $_sl"
            done
            continue
        fi
        # A partition (sda1, nvme0n1p2) names its parent disk via 'partition'.
        if [ -e "$_dir/partition" ]; then
            _out="$_out $(basename "$(dirname "$(readlink -f "$_dir")")")"
        else
            _out="$_out $_q"
        fi
    done
    # Sorted, de-duplicated, joined with "+" (a RAID1 over two disks keeps both).
    echo $_out | tr ' ' '\n' | sed '/^$/d' | sort -u | tr '\n' '+' | sed 's/+$//'
}

gen_storage() {
    TMP="${STORAGE}.tmp"
    HOST="$(hostname)"
    NOW="$(date +%s)000"
    {
        printf '{"generatedAt":%s,"host":"%s","mounts":[' "$NOW" "$(printf '%s' "$HOST" | sed 's/\\/\\\\/g; s/"/\\"/g')"
        FIRST=1
        { df -kP 2>/dev/null || df -k 2>/dev/null; } | while read -r FS TOTAL USED AVAIL CAP MOUNT _REST; do
            # Skip the header and any line without a numeric total.
            case "$TOTAL" in ''|*[!0-9]*) continue ;; esac
            [ "$TOTAL" -le 0 ] 2>/dev/null && continue
            [ -n "$MOUNT" ] || continue
            # df -P escapes spaces in the mount point as \040.
            MOUNT=$(printf '%s' "$MOUNT" | sed 's/\\040/ /g')
            PCT=$(printf '%s' "$CAP" | tr -cd '0-9')
            [ -n "$PCT" ] || PCT=0
            DISK=""
            BN=$(block_name "$FS")
            if [ -n "$BN" ]; then
                DISK=$(phys_disk "$BN")
            fi
            if [ "$FIRST" = 0 ]; then printf ','; fi
            FIRST=0
            printf '\n{"filesystem":"%s","mountpoint":"%s","disk":"%s","totalKb":%s,"usedKb":%s,"availKb":%s,"usedPercent":%s}' \
                "$(printf '%s' "$FS" | sed 's/\\/\\\\/g; s/"/\\"/g')" \
                "$(printf '%s' "$MOUNT" | sed 's/\\/\\\\/g; s/"/\\"/g')" \
                "$DISK" "$TOTAL" "$USED" "$AVAIL" "$PCT"
        done
        printf '\n]}\n'
    } > "$TMP" 2>/dev/null && mv "$TMP" "$STORAGE"
    return 0
}

gen_storage
( while :; do sleep 15; gen_storage; done ) &

echo "[entrypoint] generated $CONF (PORTAINER_URL=$PORTAINER_URL)"
