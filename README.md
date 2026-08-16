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

## Why it's light on memory

- **Multi-stage build** — the final image has no Node.js runtime and no npm packages, only static files.
- **nginx:alpine** as the web server (~25 MB image, roughly 5–8 MB RAM at idle).
- **Memory-tuned nginx** — single worker process, access logging disabled, low `worker_connections`.
- Built-in `HEALTHCHECK` so Compose can report container health.

## Development

```bash
npm ci
npm run dev      # dev server, /api/* proxied to PORTAINER_URL (default http://localhost:9000)
npm run build    # production build to dist/
```
