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

If the app and Portainer live on **different origins** (different domains), the browser blocks the direct cross-origin calls unless Portainer allows CORS. Two options:

**Option 1 — same-origin proxy (recommended).** The container's nginx forwards `/api/*` to Portainer server-side, so there's no CORS at all. Set `PORTAINER_URL` and expose the app via Traefik labels (see `compose.yaml`):

```yaml
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

Then in the app's Connect screen, enter **the app's own URL** (`https://pm.example.com`), not the Portainer URL, plus your API key.

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
