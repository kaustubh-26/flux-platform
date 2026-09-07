# -------------------------------
# Build stage (Simulated - No slow emulation running)
# -------------------------------
FROM alpine AS builder
WORKDIR /app/frontend

# Simply receive the already compiled static files from your host machine
COPY frontend/dist ./dist

# -------------------------------
# Runtime stage (Nginx Secure Non-Root Pattern)
# -------------------------------
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from our simulated builder stage
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

