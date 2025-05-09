# -------------------------------
# Build stage
# -------------------------------
FROM node:22.17.1-alpine AS builder

WORKDIR /app

# Root manifests
COPY package.json package-lock.json ./
COPY services/crypto-service/package.json services/crypto-service/

# Install ALL deps (including dev)
RUN npm ci --workspaces --include-workspace-root=false

# Build
COPY services/crypto-service services/crypto-service
WORKDIR /app/services/crypto-service
RUN npm run build

# -------------------------------
# Runtime stage
# -------------------------------
FROM node:22.17.1-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY services/crypto-service/package.json services/crypto-service/

# Install ONLY production deps
RUN npm ci --workspaces --include-workspace-root=false --omit=dev

# Copy compiled output only
COPY --from=builder /app/services/crypto-service/dist services/crypto-service/dist

WORKDIR /app/services/crypto-service

EXPOSE 3001
CMD ["node", "dist/server.js"]
