FROM node:22.17.1-alpine
RUN apk add --no-cache libatomic
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY services/auth-service/package.json ./services/auth-service/package.json
COPY services/auth-service/dist ./services/auth-service/dist

WORKDIR /app/services/auth-service
EXPOSE 4001
ENV NODE_OPTIONS="--max-old-space-size=48"
CMD ["node", "dist/server.js"]

