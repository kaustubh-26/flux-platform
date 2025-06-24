# -------------------------------
# Build stage
# -------------------------------
FROM node:22.17.1-alpine AS builder

WORKDIR /app

# Root manifests (workspace)
COPY package.json package-lock.json ./

# Frontend workspace manifest
COPY frontend/package.json frontend/

# Install deps (dev deps needed for build)
RUN npm ci --workspaces --include-workspace-root=false

# Copy source
COPY frontend frontend

# Build Vite app
WORKDIR /app/frontend
RUN npm run build


# -------------------------------
# Runtime stage (Nginx)
# -------------------------------
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
