# -------------------------------
# Build stage
# -------------------------------
FROM node:22.17.1-alpine AS builder

WORKDIR /app

# Root manifests
COPY package.json package-lock.json ./

# Workspace manifest
COPY services/news-service/package.json services/news-service/

# Install ALL deps (including dev)
RUN npm ci --workspaces --include-workspace-root=false

# Copy source
COPY services/news-service services/news-service

# Build
WORKDIR /app/services/news-service
RUN npm run build


# -------------------------------
# Runtime stage
# -------------------------------
FROM node:22.17.1-alpine

WORKDIR /app
ENV NODE_ENV=production

# Root + workspace manifests
COPY package.json package-lock.json ./
COPY services/news-service/package.json services/news-service/

# Install ONLY production deps
RUN npm ci --workspaces --include-workspace-root=false --omit=dev

# Copy compiled output only
COPY --from=builder /app/services/news-service/dist services/news-service/dist

WORKDIR /app/services/news-service

EXPOSE 3003
CMD ["node", "dist/server.js"]
