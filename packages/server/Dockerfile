FROM node:20-alpine
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
COPY src/ ./src/

# Install all deps (needed for workspace)
RUN npm install --workspace=packages/server --include-workspace-root

# Copy server source
COPY packages/server/ ./packages/server/

# Build TypeScript
RUN npm run build --workspace=packages/server

EXPOSE 3001
CMD ["node", "packages/server/dist/src/server/index.js"]
