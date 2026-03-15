FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/reports/package*.json ./packages/reports/

RUN npm ci --workspace=@only-facts/reports

COPY packages/reports ./packages/reports

RUN npm run build -w @only-facts/reports

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/packages/reports/.next/standalone ./
COPY --from=builder /app/packages/reports/.next/static ./packages/reports/.next/static
COPY --from=builder /app/packages/reports/public ./packages/reports/public

EXPOSE 3001

USER node

CMD ["node", "packages/reports/server.js"]
