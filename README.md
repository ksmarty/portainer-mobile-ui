# Portainer Mobile

A mobile-first web UI for [Portainer](https://www.portainer.io/), built with React + Vite + Tailwind. Connect to any Portainer instance with an API key or JWT, or explore the built-in demo mode.

## Run with Docker Compose

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

### Behind Traefik (or any reverse proxy)

If the app and Portainer live on **different origins** (different domains), the browser blocks the direct cross-origin calls unless Portainer allows CORS. Two options:

**Option 1 — same-origin proxy (recommended):** set `PORTAINER_URL` in `compose.yaml`, then in the app's Connect screen enter the **app's own URL** (the domain you serve the app on), not the Portainer URL. The container's nginx proxies `/api/*` to Portainer server-side, so there's no CORS at all:

```yaml
services:
  portainer-mobile:
    build: .
    environment:
      PORTAINER_URL: "https://portainer.example.com"
    # ... labels/network to expose it via Traefik
```

**Option 2 — CORS middleware on the Portainer router** (Traefik file provider). Keep entering `https://portainer.example.com` in the app:

```yaml
http:
  middlewares:
    cors-for-mobile:
      headers:
        accessControlAllowOriginList:
          - "https://pm.example.com"          # the app's origin
        accessControlAllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        accessControlAllowHeaders:
          - Content-Type
          - X-API-Key
          - Authorization
        accessControlMaxAge: 600
  routers:
    portainer:
      rule: Host(`portainer.example.com`)
      service: portainer
      middlewares: [cors-for-mobile]
```

## Why it's light on memory

- **Multi-stage build** — the final image has no Node.js runtime and no npm packages, only static files.
- **nginx:alpine** as the web server (~25 MB image, roughly 5–8 MB RAM at idle).
- **Memory-tuned nginx** — single worker process, access logging disabled, low `worker_connections`.
- Built-in `HEALTHCHECK` so Compose can report container health.

## CI & releases (GitHub Actions)

Workflows live in `.github/workflows/`, following the pattern used by [ksmarty/v1](https://github.com/ksmarty/v1):

- **`ci.yml`** — runs on every pull request to `main`: builds the frontend and verifies the Docker image builds (`linux/amd64`). The build output is cached with `type=gha` so repeat runs are fast.
- **`release.yml`** — runs on pushes to `main` (and manually). It:
  1. Computes the next semver tag from conventional commits since the last tag (`feat:` → minor, `feat!:`/`BREAKING CHANGE` → major, anything else → patch). Manual runs use the bump you pick instead. No commits → no release.
  2. Builds a multi-arch image (`linux/amd64` + `linux/arm64`) and pushes it to **`ghcr.io/<owner>/portainer-mobile`**, tagged with the new version and `latest`.
  3. Creates a GitHub Release with auto-generated notes.

The release tag and commit SHA are passed as `VERSION`/`COMMIT` build-args and baked into the image at `/version.json`.

**Manual release:** Actions → **Release** → *Run workflow* → pick `patch` / `minor` / `major`.

**Pull the published image:**

```bash
docker pull ghcr.io/<owner>/portainer-mobile:latest
docker run -d --name portainer-mobile -p 8080:80 ghcr.io/<owner>/portainer-mobile
```

## Development

```bash
npm ci
npm run dev      # dev server, /api/* proxied to PORTAINER_URL (default http://localhost:9000)
npm run build    # production build to dist/
```
