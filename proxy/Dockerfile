FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3100
ENV PORT=3100
ENV NODE_ENV=production

CMD ["node", "--import", "tsx", "src/server.ts"]
