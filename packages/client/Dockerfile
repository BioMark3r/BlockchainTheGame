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

# The WebSocket URL is determined at runtime from window.location — nothing
# is baked into the bundle. The same image works on any hostname.
RUN npm run build --workspace=packages/client

# Stage 2: serve the built SPA with nginx
FROM nginx:alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
