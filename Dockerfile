# syntax=docker/dockerfile:1
#
# Multi-stage build:
#   1. node:alpine   -> compiles the Vite/React bundle
#   2. nginx:alpine  -> serves the static files (final image ~25 MB, ~5-8 MB RAM)
#
# The final image contains no Node.js runtime and no npm packages — just static
# files served by nginx, which keeps memory usage as low as possible.

# ---------- Build stage ----------
FROM node:22-alpine AS build
# Build metadata passed by CI (.github/workflows/*.yml)
ARG VERSION=dev
ARG COMMIT=unknown
WORKDIR /app

# Install dependencies first so Docker can cache this layer
COPY package.json package-lock.json ./
RUN npm ci

# Build the app
COPY . .
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine
# Build metadata passed by CI (build-args in .github/workflows/*.yml)
ARG VERSION=dev
ARG COMMIT=unknown

# Minimal, memory-tuned nginx config (single worker, no access logs)
COPY nginx.conf /etc/nginx/nginx.conf

# Entrypoint script that generates the server block and an optional /api proxy
# (runs via the official nginx image's /docker-entrypoint.d mechanism)
COPY docker-entrypoint.d/30-server-config.sh /docker-entrypoint.d/30-server-config.sh
RUN chmod +x /docker-entrypoint.d/30-server-config.sh

# Static bundle from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose build metadata (served at /version.json, e.g. by CI/debugging)
RUN printf '{"version":"%s","commit":"%s"}\n' "$VERSION" "$COMMIT" > /usr/share/nginx/html/version.json

# Version the service-worker cache name per release so a new build can never
# serve the previous build's cached shell/assets.
RUN sed -i "s/pm-cache-v1/pm-cache-${VERSION}/g" /usr/share/nginx/html/sw.js

# Lightweight healthcheck (busybox wget ships with alpine)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

EXPOSE 80

STOPSIGNAL SIGQUIT
