# E-Learning Platform — Kursus Bahasa Jepang (Single-Tenant)

Platform B2B untuk satu lembaga kursus bahasa Jepang: aplikasi murid, aplikasi
admin, dan satu backend NestJS. Menggantikan produk single-user sebelumnya
(`webapp/` di repo `BELAJAR BAHASA` yang terpisah) — lihat PRD lengkap di
`C:\Users\firma\Documents\kimi\Workspaces\E-LEARN\PRD-Aplikasi-Belajar-Bahasa-Jepang.md`
(v4.0) untuk detail requirement, dan plan implementasi fondasi di
`C:\Users\firma\.claude\plans\sunny-cooking-floyd.md` untuk keputusan
arsitektur (skema DB, breakdown modul, urutan milestone).

## Struktur

```
apps/
  student/   React + Vite — aplikasi murid (PWA)
  admin/     React + Vite — aplikasi admin/pengajar
  api/       NestJS — satu backend (auth, konten, gamifikasi, AI tutor)
packages/
  domain/    Logic murni (framework-free): exercise engine, XP/streak/badge, SRS, path layout
  ui/        Primitif UI bersama (shadcn/ui + token Tailwind)
  config/    Preset eslint/tailwind bersama
```

## Menjalankan untuk pengembangan

```bash
pnpm install
docker compose up -d      # postgres + redis (audio disimpan di disk lokal: apps/api/storage)
pnpm db:migrate
pnpm db:seed              # isi konten Hiragana + badge
pnpm dev                  # jalankan api + student + admin sekaligus (Turborepo)
```

Salin `apps/api/.env.example` ke `apps/api/.env` dan isi `OPENAI_API_KEY`
sebelum menjalankan `apps/api` (dibutuhkan `TutorModule`).

## Menjalankan di server sendiri (Docker Compose)

Stack produksi satu server (murid, admin, API, Postgres, Redis, penyimpanan audio, HTTPS otomatis) ada di
[`deploy/`](deploy). Panduan lengkap: [`docs/DEPLOY.md`](docs/DEPLOY.md). Ringkasnya:

```bash
cd deploy
sh gen-env.sh && nano .env          # rahasia acak + alamat domain/IP
docker compose up -d --build
docker compose run --rm tools pnpm run db:seed
docker compose run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD tools pnpm run admin:create
```
