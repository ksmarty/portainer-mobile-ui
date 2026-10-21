# Portainer Mobile

A mobile-first web UI for [Portainer](https://www.portainer.io/), built with React + Vite + Tailwind. Connect to any Portainer instance with an API key or JWT, or explore the built-in demo mode.

## Run the published image (GHCR)

The built image is published to **`ghcr.io/ksmarty/portainer-mobile-ui`** by the Release workflow (Actions → Release → Run workflow), tagged with a semver version and `latest`. The repo ships `compose.ghcr.yaml` — or copy the compose file straight from here:

```yaml
services:
  portainer-mobile:
    image: ghcr.io/ksmarty/portainer-mobile-ui:latest
    container_name: portainer-mobile
    # Direct access on :8080 (optional). Remove if Traefik is the only ingress.
    ports:
      - "8080:80"
    environment:
      # Same-origin proxy: forwards /api/* to Portainer server-side (no CORS).
      # Then in the app, connect with THIS app's own URL, not the Portainer URL.
      PORTAINER_URL: "https://portainer.example.com"
    labels:
      - traefik.enable=true
      - traefik.http.routers.portainer-mobile.rule=Host(`pm.example.com`)
      - traefik.http.routers.portainer-mobile.entrypoints=websecure
      - traefik.http.routers.portainer-mobile.tls.certresolver=letsencrypt
      - traefik.http.services.portainer-mobile.loadbalancer.server.port=80
    networks:
      - traefik
    restart: unless-stopped

networks:
  traefik:
    external: true
```

Start it with:

```bash
docker compose -f compose.ghcr.yaml up -d        # using the repo's file
# or, if you pasted the YAML above into your own compose file:
docker compose up -d
```

**Options:**

| Environment variable | Default | Description |
| --- | --- | --- |
| `PORTAINER_URL` | *(unset)* | When set, `/api/*` is proxied to this Portainer instance (avoids CORS). Leave unset to enter the Portainer URL directly in the app. |

**First-time notes:**

- The image must exist on GHCR — trigger the Release workflow once (see [CI & releases](#ci--releases-github-actions)). Until then use the [local build](#run-with-docker-compose-local-build).
- GHCR packages are private by default: set the package visibility to **public** (GitHub → your profile → Packages) if you want to pull without a token.
- If Portainer is not publicly resolvable from the container, use its internal hostname in `PORTAINER_URL` (e.g. `http://portainer:9000`).

Or run it directly:

```bash
docker pull ghcr.io/ksmarty/portainer-mobile-ui:latest
docker run -d --name portainer-mobile -p 8080:80 ghcr.io/ksmarty/portainer-mobile-ui
```

## Run with Docker Compose (local build)

The project ships a `Dockerfile` (multi-stage: Node builds the bundle, **nginx:alpine** serves it) and a `compose.yaml`.

```bash
docker compose up -d --build
```

Then open **http://localhost:8080** and connect to Portainer:

1. Enter your Portainer URL (e.g. `https://portainer.example.com`)
2. Paste an API key (Portainer → My account → Access tokens) or a JWT
3. Hit **Connect** — or use **Explore the demo** to try the UI without a server

> If Portainer doesn't allow CORS from another origin, set `PORTAINER_URL` in `compose.yaml` and the container will reverse-proxy `/api/*` to it, so the UI talks same-origin. In that case enter the app's own URL in the connect screen.

### Options

| Environment variable | Default | Description |
| --- | --- | --- |
| `PORTAINER_URL` | *(unset)* | Optional. When set, `/api/*` is proxied to this Portainer instance (avoids CORS). |

### Just `docker run`

```bash
docker build -t portainer-mobile .
docker run -d --name portainer-mobile -p 8080:80 portainer-mobile
```

### With a Portainer proxy

```bash
docker run -d --name portainer-mobile -p 8080:80 \
  -e PORTAINER_URL=https://portainer.example.com \
  portainer-mobile
```

### Behind Traefik (Docker provider / labels)

If the app and Portainer live on **different origins**, the browser blocks the direct cross-origin calls unless Portainer allows CORS. Note: **different subdomains are still different origins** — `pm.notato.xyz` vs `portainer.notato.xyz` is still CORS. Two options:

**Option 1 — same-origin proxy (recommended).** The container's nginx forwards `/api/*` to Portainer server-side, so there's no CORS at all. Set `PORTAINER_URL` and expose the app via Traefik labels (see `compose.yaml`):```yaml
services:
  portainer-mobile:
    build: .
    environment:
      PORTAINER_URL: "https://portainer.example.com"
    labels:
      - traefik.enable=true
      - traefik.http.routers.portainer-mobile.rule=Host(`pm.example.com`)
      - traefik.http.routers.portainer-mobile.entrypoints=websecure
      - traefik.http.routers.portainer-mobile.tls.certresolver=letsencrypt
      - traefik.http.services.portainer-mobile.loadbalancer.server.port=80
    networks:
      - traefik   # external network attached to your Traefik instance
```

Then in the app's Connect screen, enter **the app's own URL** (`https://pm.example.com`), not the Portainer URL, plus your API key. When the container is running with `PORTAINER_URL` set, the Connect screen detects the proxy and **prefills the app's own URL automatically**.

**Option 2 — CORS middleware via labels on the Portainer container.** Keep entering `https://portainer.example.com` in the app:

```yaml
labels:
  - traefik.http.routers.portainer.rule=Host(`portainer.example.com`)
  - traefik.http.routers.portainer.entrypoints=websecure
  - traefik.http.routers.portainer.tls.certresolver=letsencrypt
  - traefik.http.routers.portainer.middlewares=cors-for-mobile@docker
  - traefik.http.middlewares.cors-for-mobile.headers.accesscontrolalloworiginlist=https://pm.example.com
  - traefik.http.middlewares.cors-for-mobile.headers.accesscontrolallowmethods=GET,POST,PUT,DELETE,OPTIONS
  - traefik.http.middlewares.cors-for-mobile.headers.accesscontrolallowheaders=Content-Type,X-API-Key,Authorization
  - traefik.http.middlewares.cors-for-mobile.headers.accesscontrolmaxage=600
```

## Why it's light on memory

- **Multi-stage build** — the final image has no Node.js runtime and no npm packages, only static files.
- **nginx:alpine** as the web server (~25 MB image, roughly 5–8 MB RAM at idle).
- **Memory-tuned nginx** — single worker process, access logging disabled, low `worker_connections`.
- Built-in `HEALTHCHECK` so Compose can report container health.

## Host storage & drives

The dashboard's **Storage** dial and the **Drive info** screen show the disk the app (and, when it runs on the same host, Portainer) is using. The container entrypoint generates `/storage.json` from `df` and refreshes it every 15 seconds, so the numbers track live usage without an app rebuild:

- The container root filesystem is the host's overlay backing store, so `df /` reports the **main drive** — that's the dial's default.
- **Every attached disk is listed, mounted or not.** `df` can only ever name filesystems that are in use, so the entrypoint also reads `/sys/class/block` — which is *not* namespaced — and reports every whole block device with its model, size and rotational flag. `/sys` is shared with the host even without a bind mount, which is why the spare SSD and the two unused 3 TB drives now appear next to the disk Docker lives on. A drive with no filesystem mounted shows its raw capacity and an `unmounted` chip instead of a usage bar.
- Bind-mounting the host root (`- /:/host:ro,rslave`) additionally makes every *host* filesystem visible, so partitions on other disks show real used/free figures rather than capacity only. The app falls back to a demo snapshot when the file isn't served (local dev / preview).
- The screen is **grouped by physical drive**, not by mount. One drive normally shows up several times in `df` (root overlay, an LVM volume, `/boot/efi`), so raw mounts report the same capacity repeatedly; the entrypoint resolves each filesystem to its backing disk via `/sys/class/block` (`nvme0n1p2` → `nvme0n1`, a device-mapper volume walks its `slaves`, a RAID set joins them as `sda+sdb`) and the UI folds those mounts into one card. A device-less root (the container's overlay) is folded into the physical group reporting identical capacity and usage, so it lands on the disk that actually backs it.
- **Sizes are emitted in KiB, not bytes.** Busybox awk — the awk in the alpine nginx image — prints `%d` through a 32-bit int, so `kB * 1024` overflowed above ~2 GB and wrote negative byte counts, which the UI rendered as `NaN undefined`. KiB fits, and the frontend multiplies by 1024 in JS. `bytes()` also guards non-finite/negative input now, so no code path can print that string again.

Docker's own storage breakdown (`docker system df` — images, containers, volumes, build cache and what's reclaimable) is shown on the same screen, summed from the active endpoint.

## Container memory

**Quick access → Container memory** ranks every container by RAM, highest first, with the total held by containers against host RAM and a "closest to limit" sort for the case where one container has a small limit and is sitting on it.

Memory is a gauge rather than a counter, so one one-shot stats sample per container is enough — the requests go out in parallel and the whole ranking costs about as long as the slowest single container. Page cache is subtracted from `usage`, matching `docker stats`. Permissions match the rest of the app: Portainer's Docker proxy needs **read** access to container stats.

## Updating a container

The update dialog has a **Remove the old image afterwards** checkbox, checked by default. After the container is recreated from the newer image, the image it *was* running is deleted once nothing references it — otherwise each update leaves an untagged layer behind that `docker system df` counts forever.

The delete is deliberately conservative: it re-lists containers first (a sibling container or a not-yet-rolled-over stack service may still be on that image), only ever removes the **old id**, and treats `404`/`409` as success. If the delete is refused for another reason the update still stands and a toast explains why the old image was kept.

## Image cleanup

"Clean up unused images" on the Images screen removes dangling images **one at a time** in a background job that lives in the store, so it keeps running while you navigate — and it is mirrored to `localStorage` after every image, so closing the tab or reloading resumes it exactly where it left off.

Because the job is fully decoupled from the UI:

- **Progress is always visible.** A compact strip above the screen content tracks it from any screen, and the Images screen adds a detailed banner; tapping either opens Images. On a reload the job is rebuilt from storage, so the real numbers are there immediately.
- **Ownership is leased, not locked.** Each tab claims the job and refreshes a heartbeat while it works. A closed or reloaded tab stops beating, and after ~12s (or immediately on `pagehide`, which fires on reload) the next tab takes over — so two tabs never delete the same image twice, and reopening the site continues the run.
- **It can be cancelled.** The running banner's *Cancel* clears the persisted job; the loop notices between images and stops.
- **Resumed steps don't double-count.** An image the previous owner already deleted comes back as `404`, which is counted as reclaimed instead of failed.

## CPU dial

Host CPU is a share of the whole host's CPU time, so the raw `docker stats` formula must **not** be multiplied by the core count — doing that pegged a lightly-busy host at 100% on open. On top of that:

- Concurrent polls share one in-flight aggregation (the boot fetch and the 5s interval used to run separate nested polling loops and fight over the same state).
- Each poll diffs a container's counters against its previous reading instead of sleeping between two samples, so the dial updates on every poll with no added latency. The first poll of a session primes the counters with one short 600ms second sample.
- A sample far above the recent median (`> 4x` and `+45` points) is treated as the page-load burst and replaced by that median; the published value is a smoothed median of the last three samples.
- If nothing could be measured, the previous reading is kept rather than dropping to 0%.

## CI & releases (GitHub Actions)

Workflows live in `.github/workflows/`, following the pattern used by [ksmarty/v1](https://github.com/ksmarty/v1):

- **`ci.yml`** — runs on every pull request to `master`: builds the frontend and verifies the Docker image builds (`linux/amd64`). The build output is cached with `type=gha` so repeat runs are fast.
- **`release.yml`** — runs on pushes to `master` (and manually). It:
  1. Computes the next semver tag from conventional commits since the last tag (`feat:` → minor, `feat!:`/`BREAKING CHANGE` → major, anything else → patch). Manual runs use the bump you pick instead. No commits → no release.
  2. Builds a multi-arch image (`linux/amd64` + `linux/arm64`) and pushes it to **`ghcr.io/ksmarty/portainer-mobile-ui`**, tagged with the new version and `latest`.
  3. Creates a GitHub Release with auto-generated notes.

The release tag and commit SHA are passed as `VERSION`/`COMMIT` build-args and baked into the image at `/version.json`.

**Manual release:** Actions → **Release** → *Run workflow* → pick `patch` / `minor` / `major`.

To deploy the published image, see [Run the published image (GHCR)](#run-the-published-image-ghcr).

## Development

```bash
npm ci
npm run dev      # dev server, /api/* proxied to PORTAINER_URL (default http://localhost:9000)
npm run build    # production build to dist/
```
