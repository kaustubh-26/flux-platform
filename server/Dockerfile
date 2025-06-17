# -------------------------------
# Build stage
# -------------------------------
FROM node:22.17.1-alpine AS builder

WORKDIR /app

# Root manifests
COPY package.json package-lock.json ./

# Workspace manifest
COPY server/package.json server/

# Install deps (incl dev for build)
RUN npm ci --workspaces --include-workspace-root=false

# Copy source
COPY server server

# Build
WORKDIR /app/server
RUN npm run build


# -------------------------------
# Runtime stage
# -------------------------------
FROM node:22.17.1-alpine

WORKDIR /app
ENV NODE_ENV=production

# Root + workspace manifests
COPY package.json package-lock.json ./
COPY server/package.json server/

# Install ONLY production deps
RUN npm ci --workspaces --include-workspace-root=false --omit=dev

# Copy compiled output only
COPY --from=builder /app/server/dist server/dist

WORKDIR /app/server

EXPOSE 3000
CMD ["node", "dist/server.js"]