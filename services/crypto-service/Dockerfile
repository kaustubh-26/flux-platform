FROM node:22.17.1-alpine
RUN apk add --no-cache libatomic
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY services/crypto-service/package.json ./services/crypto-service/package.json
COPY services/crypto-service/dist ./services/crypto-service/dist

WORKDIR /app/services/crypto-service
EXPOSE 3001
ENV NODE_OPTIONS="--max-old-space-size=48 --turbo-string-builder"
CMD ["node", "dist/server.js"]

