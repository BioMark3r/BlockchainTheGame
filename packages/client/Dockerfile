# Stage 1: build the React app
FROM node:20-alpine AS builder
WORKDIR /app

# Copy ALL workspace manifests first so npm ci can resolve the workspace graph
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install all deps from lock file (fast and deterministic)
RUN npm ci

# Copy source files needed for the client build
# (src/shared is aliased as @shared in vite.config.ts)
COPY src/ ./src/
COPY packages/client/ ./packages/client/

# VITE_WS_URL is intentionally left without a default.
# When not provided, ARG values are NOT passed to RUN commands, so Vite sees
# import.meta.env.VITE_WS_URL as undefined and the client uses
# ws(s)://window.location.host/ws at runtime (proxied by nginx).
# Pass --build-arg VITE_WS_URL=wss://... only if the WS server is on a
# completely different host from the client.
ARG VITE_WS_URL

RUN if [ -n "$VITE_WS_URL" ]; then \
      VITE_WS_URL="$VITE_WS_URL" npm run build --workspace=packages/client; \
    else \
      npm run build --workspace=packages/client; \
    fi

# Stage 2: serve the built SPA with nginx
FROM nginx:alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
