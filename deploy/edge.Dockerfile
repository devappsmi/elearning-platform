# Build context: root repo -- lihat deploy/docker-compose.yml (context: .., dockerfile: deploy/edge.Dockerfile).
#
# Membangun KEDUA aplikasi web (murid + admin) menjadi berkas statis dan menaruhnya di Caddy, yang sekaligus
# reverse proxy (HTTPS otomatis, /api -> API, /media -> penyimpanan; konfigurasi di deploy/Caddyfile).
#
# VITE_API_URL=/api: aplikasi memanggil API lewat alamat RELATIF di origin yang sama (Caddy meneruskan /api
# ke API), jadi image ini tidak terikat ke domain/IP tertentu dan tidak butuh CORS. Nilai ini ikut TERPANGGANG
# ke bundel JS saat build.

FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
ENV VITE_API_URL=/api
# `nama...` = paket itu beserta dependensi workspace-nya (domain, api-client, ui), dibangun berurutan.
RUN pnpm --filter "student..." --filter "admin..." run build

FROM caddy:2-alpine
COPY --from=build /repo/apps/student/dist /srv/student
COPY --from=build /repo/apps/admin/dist /srv/admin
COPY deploy/Caddyfile /etc/caddy/Caddyfile
