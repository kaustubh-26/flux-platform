FROM node:22.17.1-alpine
RUN apk add --no-cache libatomic
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY services/weather-service/package.json ./services/weather-service/package.json
COPY services/weather-service/dist ./services/weather-service/dist

WORKDIR /app/services/weather-service
EXPOSE 3000
ENV NODE_OPTIONS="--max-old-space-size=48 --turbo-string-builder"
CMD ["node", "dist/server.js"]

