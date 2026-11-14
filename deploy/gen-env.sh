#!/bin/sh
# Membuat deploy/.env dari .env.example dengan rahasia acak (JWT_STUDENT_SECRET, JWT_ADMIN_SECRET, dan POSTGRES_PASSWORD
# untuk Postgres bawaan). Tidak menimpa .env yang sudah ada.
#
#   sh gen-env.sh              # Postgres YANG SUDAH ADA (bawaan): isi DATABASE_URL sendiri
#   sh gen-env.sh --builtin-db # Postgres bawaan stack ini (container `postgres`, untuk uji cepat)
#
# Alamat akses (STUDENT_ADDRESS, ADMIN_ADDRESS, PUBLIC_*_URL) dan DATABASE_URL tetap harus Anda sunting sendiri.
set -eu
cd "$(dirname "$0")"

MODE=external
case "${1:-}" in
  "") ;;
  --builtin-db) MODE=builtin ;;
  *) echo "pakai: sh gen-env.sh [--builtin-db]" >&2; exit 1 ;;
esac

if [ -e .env ]; then
  echo ".env sudah ada -- tidak ditimpa (hapus dulu kalau ingin membuatnya ulang)."
  exit 0
fi

# 24 byte acak dalam heksadesimal: aman dipakai di URL database maupun sebagai kunci.
rand() { head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# Mode bawaan: kosongkan DATABASE_URL (=> Postgres bawaan) dan aktifkan profilnya. Mode lain: ungkapan sed kosong.
if [ "$MODE" = builtin ]; then
  DB_URL='s|^DATABASE_URL=.*|DATABASE_URL=|'
  DB_PROFILE='s|^# COMPOSE_PROFILES=builtin-db|COMPOSE_PROFILES=builtin-db|'
else
  DB_URL='s|^$||'
  DB_PROFILE='s|^$||'
fi

umask 077 # .env berisi rahasia: hanya pemilik yang boleh membaca
sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rand)|" \
  -e "s|^JWT_STUDENT_SECRET=.*|JWT_STUDENT_SECRET=$(rand)|" \
  -e "s|^JWT_ADMIN_SECRET=.*|JWT_ADMIN_SECRET=$(rand)|" \
  -e "$DB_URL" \
  -e "$DB_PROFILE" \
  .env.example > .env

echo "deploy/.env dibuat dengan rahasia acak."
if [ "$MODE" = builtin ]; then
  echo "Postgres BAWAAN diaktifkan (COMPOSE_PROFILES=builtin-db, DATABASE_URL kosong)."
  echo "Sekarang sunting alamat akses di dalamnya (STUDENT_ADDRESS, ADMIN_ADDRESS, PUBLIC_STUDENT_URL, PUBLIC_ADMIN_URL)."
else
  echo "Sekarang sunting di dalamnya:"
  echo "  - DATABASE_URL (Postgres Anda: postgresql://PENGGUNA:KATA_SANDI@HOST:5432/NAMA_DATABASE; karakter khusus di-encode)"
  echo "  - alamat akses (STUDENT_ADDRESS, ADMIN_ADDRESS, PUBLIC_STUDENT_URL, PUBLIC_ADMIN_URL)"
  echo "Lalu periksa koneksi database:  docker compose run --rm tools pnpm run db:check"
fi
