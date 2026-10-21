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
# Emits /usr/share/nginx/html/storage.json so the dashboard can show the disks
# the host is using. Refresh happens on a loop so the numbers track live usage
# without an app rebuild.
#
# Two sources, in this order of preference:
#
#  1. The host mount table, read from /host/proc/self/mounts. This lists every
#     partition the host has mounted — which `df` inside a container does NOT,
#     because a container only sees its own namespace. It requires the host
#     root to be bind-mounted at /host (compose.yaml does this with
#     `- /:/host:ro,rslave`; `rslave` propagates the host's mounts into the
#     container, `ro` keeps us from writing to them).
#  2. Plain `df` on the container's own mounts. Always available, but it only
#     reports the filesystem the container sits on (the host's overlay store),
#     so other drives are invisible. This is the fallback for a deployment
#     without the /host mount.
#
# Sizes are emitted in KiB, never in bytes: busybox awk (the awk in the alpine
# nginx image) prints %d through a 32-bit int, so `kB * 1024` overflowed at
# ~2 GB and produced negative byte counts — which the UI rendered as
# "NaN undefined". KiB stays well inside the range for any real disk, and the
# frontend multiplies by 1024 in JS where the numbers are doubles.
STORAGE=/usr/share/nginx/html/storage.json
# The host root, bind-mounted read-only with mount propagation (compose.yaml).
HOST_ROOT=/host
# Our own mount namespace. Procfs is scoped to the reader's pid namespace, so
# this is the only table that is reliably *ours* — and with `rslave` it already
# carries the host's mounts, prefixed with $HOST_ROOT.
MOUNTINFO=/proc/self/mountinfo

# Map a filesystem to its kernel block-device name. df reports whatever the
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

# Does this container see the host's filesystems? When the host root is
# bind-mounted at /host with mount propagation, the host's real mounts show up
# in OUR namespace as /host<path> — so the answer is read from our own mount
# table, not from /host/proc. Reading /host/proc/1/mounts would be wrong: procfs
# resolves PIDs inside the container's own pid namespace, so it would hand back
# the container's mounts and look successful while reporting nothing.
host_mounts_visible() {
    grep -q " ${HOST_ROOT}/" "$MOUNTINFO" 2>/dev/null || grep -q " ${HOST_ROOT} " "$MOUNTINFO" 2>/dev/null
}

# Filesystem types that carry no capacity worth reporting. Docker's own overlay
# layers, snap squashfs images and every kernel pseudo-fs land here, which is
# what keeps the list down to the disks a person actually thinks about.
is_pseudo_fs() {
    case "$1" in
        proc|sysfs|devtmpfs|devpts|tmpfs|ramfs|cgroup|cgroup2|securityfs|debugfs|\
tracefs|pstore|bpf|configfs|fusectl|mqueue|hugetlbfs|autofs|nsfs|efivarfs|\
binfmt_misc|squashfs|overlay|rpc_pipefs|nfsd|selinuxfs|fuse.lxcfs|fuse.gvfsd-fuse)
            return 0 ;;
    esac
    return 1
}

# Escape a string for JSON.
json_str() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

# One JSON object for a mount, or nothing when df can't size it.
# $1 filesystem  $2 mountpoint  $3 path to run df on
emit_mount() {
    _fs=$1
    _mp=$2
    _path=$3
    # df -P: one line per filesystem, no wrapped device names. busybox has it.
    _line=$(df -kP "$_path" 2>/dev/null | sed -n '2p')
    [ -n "$_line" ] || return 0
    # shellcheck disable=SC2086
    set -- $_line
    _t=$2
    _u=$3
    _a=$4
    _cap=$5
    case "$_t" in ''|*[!0-9]*) return 0 ;; esac
    [ "$_t" -gt 0 ] 2>/dev/null || return 0
    _pct=$(printf '%s' "$_cap" | tr -cd '0-9')
    [ -n "$_pct" ] || _pct=0
    _disk=""
    _bn=$(block_name "$_fs")
    if [ -n "$_bn" ]; then
        _disk=$(phys_disk "$_bn")
    fi
    printf '\n{"filesystem":"%s","mountpoint":"%s","disk":"%s","totalKb":%s,"usedKb":%s,"availKb":%s,"usedPercent":%s}' \
        "$(json_str "$_fs")" "$(json_str "$_mp")" "$_disk" "$_t" "$_u" "$_a" "$_pct"
}

# Every physical disk on the host, whether or not it is mounted anywhere.
#
# This matters because a container's mount table only ever lists filesystems
# that are mounted *into the container*, and the host-mount path above only
# lists filesystems that are mounted at all — a drive that has never been
# mounted, or a partition that was unmounted, is invisible to both. /sys is not
# namespaced for block devices, so /sys/class/block shows the host's real disks
# even with no /host bind mount.
#
# A leaf block device (no partitions inside it, no devices layered underneath)
# with no `partition` file is a whole disk: sda, nvme0n1, vda. Logical devices
# (dm-*, md*) are skipped on purpose — they hold slaves, and their capacity is
# already reported by the filesystem mounted from them.
emit_devices() {
    printf '"devices":['
    _first=1
    for _d in /sys/class/block/*; do
        _n=$(basename "$_d")
        case "$_n" in
            loop*|ram*|sr*|zram*|nbd*|fd*) continue ;;
        esac
        # Partitions are folded into their parent disk.
        [ -e "$_d/partition" ] && continue
        # Anything with a backing device is a logical volume/array, not a disk.
        [ -d "$_d/slaves" ] && [ -n "$(ls -A "$_d/slaves" 2>/dev/null)" ] && continue
        # 512-byte sectors; a disk reporting 0 is a card reader with no media.
        _sz=$(cat "$_d/size" 2>/dev/null)
        case "$_sz" in ''|*[!0-9]*) continue ;; esac
        [ "$_sz" -gt 0 ] 2>/dev/null || continue
        # KiB keeps the number inside busybox awk/bc integer range.
        _kb=$((_sz / 2))
        _model=""
        [ -r "$_d/device/model" ] && _model=$(cat "$_d/device/model" 2>/dev/null | tr -s ' ' ' ' | sed 's/ *$//')
        [ -z "$_model" ] && [ -r "$_d/device/vendor" ] && _model=$(cat "$_d/device/vendor" 2>/dev/null | tr -s ' ' ' ' | sed 's/ *$//')
        _rota=1
        [ -r "$_d/queue/rotational" ] && _rota=$(cat "$_d/queue/rotational" 2>/dev/null)
        [ "$_first" = 1 ] || printf ','
        _first=0
        printf '\n{"name":"%s","model":"%s","sizeKb":%s,"rotational":%s}' \
            "$(json_str "$_n")" "$(json_str "$_model")" "$_kb" "$([ "$_rota" = 0 ] && echo false || echo true)"
    done
    printf '\n]'
}

gen_storage() {
    TMP="${STORAGE}.tmp"
    HOST="$(hostname)"
    NOW="$(date +%s)000"
    if host_mounts_visible; then MOUNTS_FILE="$MOUNTINFO"; else MOUNTS_FILE=""; fi
    {
        if [ -n "$MOUNTS_FILE" ]; then
            printf '{"generatedAt":%s,"host":"%s","hostMounts":true,"mounts":[' "$NOW" "$(json_str "$HOST")"
        else
            printf '{"generatedAt":%s,"host":"%s","hostMounts":false,"mounts":[' "$NOW" "$(json_str "$HOST")"
        fi
        FIRST=1
        if [ "$MOUNTS_FILE" = "$MOUNTINFO" ]; then
            # Host view: every filesystem the host has mounted, propagated into
            # /host by `rslave`. Capacities come from df on the propagated
            # mount, so they are the host's real figures.
            SEEN=""
            HIDDEN=0
            while read -r _line; do
                set -- $_line
                # mountinfo: id parent major:minor root mountpoint opts … - fstype source superopts
                _mp=$5
                _fstype=""
                _src=""
                _stage=0
                for _f in "$@"; do
                    case "$_stage" in
                        1) _fstype=$_f; _stage=2; continue ;;
                        2) _src=$_f; break ;;
                    esac
                    [ "$_f" = "-" ] && _stage=1
                done
                case "$_mp" in
                    "$HOST_ROOT") _mp="/" ;;
                    "$HOST_ROOT"/*) _mp=${_mp#"$HOST_ROOT"} ;;
                    *) continue ;;
                esac
                is_pseudo_fs "$_fstype" && continue
                # mountinfo escapes space, tab, newline and backslash as octal
                # (\040 …). printf %b decodes them, and unlike a sed expression
                # with a backslash replacement it works on both busybox and GNU.
                _mp=$(printf '%b' "$_mp")
                # One row per device: a filesystem is routinely bind mounted
                # several times (/etc/hosts, a config dir, …) and every row
                # would report the identical capacity.
                case "$SEEN" in *"|$_src|"*) continue ;; esac
                _path="$HOST_ROOT$_mp"
                [ "$_mp" = "/" ] && _path="$HOST_ROOT"
                # Must be a traversable directory, otherwise df silently
                # reports some enclosing filesystem instead.
                if [ ! -d "$_path" ] || [ ! -x "$_path" ]; then
                    HIDDEN=$((HIDDEN + 1))
                    continue
                fi
                _obj=$(emit_mount "$_src" "$_mp" "$_path")
                if [ -z "$_obj" ]; then
                    HIDDEN=$((HIDDEN + 1))
                    continue
                fi
                SEEN="$SEEN|$_src|"
                if [ "$FIRST" = 0 ]; then printf ','; fi
                FIRST=0
                printf '%s' "$_obj"
            done < "$MOUNTINFO"
            printf '\n]'
            printf ',"hiddenMounts":%s,' "$HIDDEN"
            emit_devices
            printf '}\n'

        else
            # Fallback: the container's own mount namespace.
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
                    "$(json_str "$FS")" "$(json_str "$MOUNT")" "$DISK" "$TOTAL" "$USED" "$AVAIL" "$PCT"
            done
            printf '\n]'
            printf ',"hiddenMounts":0,'
            emit_devices
            printf '}\n'

        fi
    } > "$TMP" 2>/dev/null && mv "$TMP" "$STORAGE"
    return 0
}

gen_storage
( while :; do sleep 15; gen_storage; done ) &

echo "[entrypoint] generated $CONF (PORTAINER_URL=$PORTAINER_URL)"
