FROM node:22.17.1-alpine
RUN apk add --no-cache libatomic
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY services/stock-service/package.json ./services/stock-service/package.json
COPY services/stock-service/dist ./services/stock-service/dist

WORKDIR /app/services/stock-service
EXPOSE 3002
ENV NODE_OPTIONS="--max-old-space-size=48 --turbo-string-builder"
CMD ["node", "dist/server.js"]

