# syntax=docker/dockerfile:1

# Imagem do Fluxo de Caixa para o ZimaOS.
#
# Dois alvos são publicados:
#   runner   → o servidor Next.js (padrão)
#   migrator → container efêmero que roda `prisma migrate deploy` e sai
#
# Por que migrations NÃO rodam aqui no build: `npm run build` chama
# scripts/migrate-deploy.mjs, que existe para o fluxo da Vercel, onde o build
# acontece com o banco acessível. Em Docker o build roda numa camada isolada,
# sem rede para o banco — a migration falharia. Por isso o build usa o alvo
# `build:docker` (sem migration) e o compose sobe o `migrator` antes do app.

FROM node:22-alpine AS base
WORKDIR /app
# Compatibilidade de glibc para binários nativos (Prisma, sharp) no Alpine.
RUN apk add --no-cache libc6-compat


# ── Dependências ──────────────────────────────────────────────────────────
FROM base AS deps
# prisma/ e prisma.config.ts precisam existir antes do npm ci: o postinstall
# do projeto roda `prisma generate`, que lê os dois.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci


# ── Build ─────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build:docker


# ── Migrator (efêmero) ────────────────────────────────────────────────────
# Mantém node_modules completo porque precisa do CLI do Prisma, que é
# devDependency. Só roda no start e morre — o peso não fica no ar.
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]


# ── Runner ────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Sem HOSTNAME=0.0.0.0 o server.js escuta só em localhost e fica inalcançável
# de fora do container — nem o cloudflared chegaria nele.
ENV HOSTNAME=0.0.0.0

# Usuário sem privilégios: se a aplicação for comprometida, o atacante não
# começa como root dentro do container.
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# O server.js do standalone não serve public/ nem .next/static sozinho —
# esses dois precisam ser copiados à mão para o lado dele.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Usa o próprio node (fetch é global no 22) em vez de curl/wget, que não estão
# garantidos na imagem. start-period cobre a subida do Next sem contar falha.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
