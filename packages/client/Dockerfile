# Stage 1: build the React app
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root and client package manifests first (layer cache)
COPY package.json package-lock.json ./
COPY packages/client/package.json ./packages/client/
# src/shared is aliased as @shared in the client (see vite.config.ts)
COPY src/ ./src/

# Install client deps via npm workspaces
RUN npm install --workspace=packages/client --include-workspace-root

# Copy full client source
COPY packages/client/ ./packages/client/

# VITE_WS_URL is baked into the bundle at build time — override for remote deploys
ARG VITE_WS_URL=ws://localhost:3001
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build --workspace=packages/client

# Stage 2: serve the built SPA with nginx
FROM nginx:alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
