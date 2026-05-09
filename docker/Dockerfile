FROM node:22-alpine

WORKDIR /app

# Native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune dev deps after build
RUN npm prune --production

EXPOSE 3000

ENV DATA_DIR=/data
ENV BODY_SIZE_LIMIT=52428800

VOLUME ["/data"]

CMD ["node", "build"]
