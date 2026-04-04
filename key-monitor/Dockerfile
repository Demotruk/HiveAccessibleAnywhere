FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/

RUN mkdir -p /data

ENV NODE_ENV=production
ENV STATE_FILE=/data/state.json

CMD ["node", "--import", "tsx", "src/index.ts"]
