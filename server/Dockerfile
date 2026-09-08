# Verified official lightweight Alpine Node base image
FROM node:22.17.1-alpine

# Set up required 32-bit system helper packages
RUN apk add --no-cache libatomic

WORKDIR /app
ENV NODE_ENV=production

# Simply copy the pre-built folders from your host into the image
COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY server/package.json ./server/package.json
COPY server/dist ./server/dist

WORKDIR /app/server
EXPOSE 3000

# Aggressive V8 memory management parameters to protect your 1GB Pi 2 RAM
ENV NODE_OPTIONS="--max-old-space-size=64 --turbo-string-builder"
CMD ["node", "dist/server.js"]

