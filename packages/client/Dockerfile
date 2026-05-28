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

# VITE_WS_URL is baked into the JS bundle at build time.
# Override when deploying remotely, e.g.: --build-arg VITE_WS_URL=ws://your-server:3001
ARG VITE_WS_URL=ws://localhost:3001
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build --workspace=packages/client

# Stage 2: serve the built SPA with nginx
FROM nginx:alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
