FROM node:20-alpine
WORKDIR /app

# Copy ALL workspace manifests first so npm ci can resolve the workspace graph
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install all deps from lock file (fast and deterministic)
RUN npm ci

# Copy source files needed for the server build
# (src/engine and src/shared are included via tsconfig rootDir)
COPY src/ ./src/
COPY packages/server/ ./packages/server/

# Compile TypeScript
# tsconfig rootDir=../../ (repo root), outDir=dist (relative to packages/server/)
# Entry point compiles to: packages/server/dist/packages/server/src/server/index.js
RUN npm run build --workspace=packages/server

EXPOSE 3001
ENV PORT=3001
CMD ["node", "packages/server/dist/packages/server/src/server/index.js"]
