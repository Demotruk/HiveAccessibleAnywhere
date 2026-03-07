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

# Create data directory for SQLite (will be mounted as a Fly volume)
RUN mkdir -p /data

EXPOSE 3200
ENV PORT=3200
ENV NODE_ENV=production
ENV GIFTCARD_DB_PATH=/data/tokens.db

CMD ["node", "--import", "tsx", "src/server.ts"]
