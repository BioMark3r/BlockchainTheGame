FROM node:20-alpine
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
# src/engine and src/shared are included in the server build (see tsconfig rootDir)
COPY src/ ./src/

# Install all deps (needed for workspace)
RUN npm install --workspace=packages/server --include-workspace-root

# Copy server source
COPY packages/server/ ./packages/server/

# Build TypeScript
# rootDir is repo root, outDir is packages/server/dist — so the compiled entry
# point lands at packages/server/dist/packages/server/src/server/index.js
RUN npm run build --workspace=packages/server

EXPOSE 3001
ENV PORT=3001
CMD ["node", "packages/server/dist/packages/server/src/server/index.js"]
