# Build context: root repo (monorepo pnpm workspace) -- lihat deploy/docker-compose.yml:
# context: .., dockerfile: apps/api/Dockerfile (target `tools` untuk migrasi/seed/admin,
# target bawaan = `runner` untuk server API).
#
# Pakai `pnpm deploy` (fitur bawaan pnpm, bukan skrip custom) untuk stage
# terakhir: itu menghasilkan folder self-contained (package.json + dist +
# node_modules ter-flatten, termasuk dependency workspace seperti
# @elearning/domain) untuk SATU package saja -- menghindari kerumitan/fragility
# meng-COPY manual symlink node_modules pnpm yang strict lintas stage.

FROM node:22-bookworm-slim AS base
# Mesin query/skema Prisma butuh OpenSSL SISTEM, yang TIDAK ada di image slim: tanpa ini Prisma memperingatkan
# "failed to detect the libssl/openssl version" lalu memilih engine openssl-1.1.x yang salah -- migrasi dan
# query gagal. Dipasang di `base` (bukan hanya di runner) supaya `prisma generate` di stage build sudah
# mengunduh engine yang benar (openssl-3.0.x) dan image runner punya libssl saat dijalankan.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @elearning/domain build
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod /deploy/api
# `pnpm deploy` menyusun node_modules BARU dari store, sehingga klien Prisma hasil generate (yang tertulis di
# dalam node_modules workspace) tidak ikut terbawa: tanpa langkah ini API gagal boot dengan "@prisma/client did
# not initialize yet". Generate ulang di folder hasil deploy, memakai CLI dari workspace.
RUN cp -r apps/api/prisma /deploy/api/prisma \
    && cd /deploy/api \
    && /repo/apps/api/node_modules/.bin/prisma generate --schema prisma/schema.prisma

# ALAT sekali-jalan, BUKAN image runtime: migrasi skema (`db:deploy`), seed konten (`db:seed`), dan
# pembuatan admin pertama (`admin:create`). Diturunkan dari stage `build` yang masih membawa
# devDependencies (prisma CLI, ts-node, TypeScript) supaya image `runner` di bawah tetap ramping dan
# tidak menyertakan CLI itu. Dipakai layanan `migrate` dan `tools` di deploy/docker-compose.yml.
FROM build AS tools
WORKDIR /repo/apps/api
# Tidak ada panggilan keluar (telemetri/cek versi) dari CLI Prisma di server produksi.
ENV CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
# Titik pasang penyimpanan audio lokal (volume media_data): dibuat milik uid 1001 (pengguna `nestjs` di image runner)
# supaya volume yang PERTAMA kali dibuat lewat container mana pun tetap bisa ditulis API.
RUN mkdir -p /data/media && chown 1001:1001 /data/media
CMD ["pnpm", "run", "db:deploy"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nestjs
# Penyimpanan audio lokal (volume media_data dipasang di sini): Docker menyalin pemilik direktori ini ke volume baru.
RUN mkdir -p /data/media && chown nestjs:nodejs /data/media

COPY --from=build --chown=nestjs:nodejs /deploy/api/dist ./dist
COPY --from=build --chown=nestjs:nodejs /deploy/api/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /deploy/api/package.json ./package.json
COPY --from=build --chown=nestjs:nodejs /repo/apps/api/prisma ./prisma

USER nestjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]
