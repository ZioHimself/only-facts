FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/engine/package*.json ./packages/engine/

RUN npm ci --workspace=@only-facts/engine

COPY packages/engine ./packages/engine

RUN npm run build -w @only-facts/engine

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/engine/dist ./dist
COPY --from=builder /app/packages/engine/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

USER node

CMD ["node", "dist/index.js"]
