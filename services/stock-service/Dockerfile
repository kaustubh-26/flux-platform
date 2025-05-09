# -------------------------------
# Build stage
# -------------------------------
FROM node:22.17.1-alpine AS builder

WORKDIR /app

# Root manifests
COPY package.json package-lock.json ./
COPY services/stock-service/package.json services/stock-service/

# Install ALL deps (including dev)
RUN npm ci --workspaces --include-workspace-root=false

# Build
COPY services/stock-service services/stock-service
WORKDIR /app/services/stock-service
RUN npm run build

# -------------------------------
# Runtime stage
# -------------------------------
FROM node:22.17.1-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY services/stock-service/package.json services/stock-service/

# Install ONLY production deps
RUN npm ci --workspaces --include-workspace-root=false --omit=dev

# Copy compiled output only
COPY --from=builder /app/services/stock-service/dist services/stock-service/dist

WORKDIR /app/services/stock-service

EXPOSE 3002
CMD ["node", "dist/server.js"]
