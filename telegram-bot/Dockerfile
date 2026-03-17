# Multi-stage build to handle better-sqlite3 native compilation
FROM node:22-alpine AS builder

# Install build dependencies for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# -- Production stage --
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled native modules from builder
COPY --from=builder /app/node_modules/better-sqlite3/build /app/node_modules/better-sqlite3/build

COPY tsconfig.json ./
COPY src/ ./src/

# Bake gift card batches into the image (read-only card files)
COPY data/giftcard-output/ ./giftcard-output/

# Create data directory for SQLite (will be mounted as a Fly volume)
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DB_PATH=/data/bot.db
ENV GIFTCARD_OUTPUT_DIR=/app/giftcard-output

CMD ["node", "--import", "tsx", "src/index.ts"]
