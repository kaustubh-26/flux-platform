# -------------------------------
# Build stage
# -------------------------------
FROM node:22.17.1-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/auth-service/package.json services/auth-service/

# Install all deps needed to build the workspace
RUN npm ci --workspaces --include-workspace-root=false

COPY services/auth-service services/auth-service
WORKDIR /app/services/auth-service

RUN npm run build

# -------------------------------
# Runtime stage
# -------------------------------
FROM node:22.17.1-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/auth-service/package.json services/auth-service/

# Install only production deps for the workspace
RUN npm ci --workspaces --include-workspace-root=false --omit=dev

COPY --from=builder /app/services/auth-service/dist services/auth-service/dist

WORKDIR /app/services/auth-service

EXPOSE 4001
CMD ["node", "dist/server.js"]
