# Olive Baby API - Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN apk add --no-cache openssl && npm ci

COPY . .

RUN npx prisma generate

RUN npm run build

# ========================================
# Produção
# ========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

RUN chown -R expressjs:nodejs /app

USER expressjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:4000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate resolve --rolled-back 20260103_promote_admin 2>/dev/null || true; npx prisma migrate deploy && node --max-old-space-size=256 dist/app.js"]
