FROM node:22.17.1-alpine
RUN apk add --no-cache libatomic
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY services/news-service/package.json ./services/news-service/package.json
COPY services/news-service/dist ./services/news-service/dist

WORKDIR /app/services/news-service
EXPOSE 3003
ENV NODE_OPTIONS="--max-old-space-size=48 --turbo-string-builder"
CMD ["node", "dist/server.js"]

