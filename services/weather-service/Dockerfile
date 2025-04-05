# -------------------------------
# Build stage
# -------------------------------
FROM node:22.17.1-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/weather-service/package.json services/weather-service/

# Install ALL deps (including dev)
RUN npm ci --workspaces --include-workspace-root=false

COPY services/weather-service services/weather-service
WORKDIR /app/services/weather-service

RUN npm run build

# -------------------------------
# Runtime stage
# -------------------------------
FROM node:22.17.1-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY services/weather-service/package.json services/weather-service/

# Install ONLY production deps
RUN npm ci --workspaces --include-workspace-root=false --omit=dev

# Copy compiled output only
COPY --from=builder /app/services/weather-service/dist services/weather-service/dist

WORKDIR /app/services/weather-service

EXPOSE 3000
CMD ["node", "dist/server.js"]
