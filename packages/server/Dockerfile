FROM node:20-alpine
WORKDIR /app

# Copy ALL workspace manifests so npm ci can resolve the workspace graph
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install all deps (includes tsx, which is used to run the server)
RUN npm ci

# Copy source files
COPY src/ ./src/
COPY packages/server/ ./packages/server/

EXPOSE 3001
ENV PORT=3001

# Use tsx to run TypeScript directly — avoids tsc output path issues caused
# by rootDir being two levels above the server package directory.
CMD ["node_modules/.bin/tsx", "packages/server/src/server/index.ts"]
