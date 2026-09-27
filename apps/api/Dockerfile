# Build context: root repo (monorepo pnpm workspace) -- lihat docker-compose.yml
# di root: context: ., dockerfile: apps/api/Dockerfile.
#
# Pakai `pnpm deploy` (fitur bawaan pnpm, bukan skrip custom) untuk stage
# terakhir: itu menghasilkan folder self-contained (package.json + dist +
# node_modules ter-flatten, termasuk dependency workspace seperti
# @elearning/domain) untuk SATU package saja -- menghindari kerumitan/fragility
# meng-COPY manual symlink node_modules pnpm yang strict lintas stage.

FROM node:22-bookworm-slim AS base
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @elearning/domain build
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod /deploy/api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nestjs

COPY --from=build --chown=nestjs:nodejs /deploy/api/dist ./dist
COPY --from=build --chown=nestjs:nodejs /deploy/api/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /deploy/api/package.json ./package.json
COPY --from=build --chown=nestjs:nodejs /repo/apps/api/prisma ./prisma

USER nestjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]
