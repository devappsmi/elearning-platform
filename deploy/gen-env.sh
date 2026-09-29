#!/bin/sh
# Membuat deploy/.env dari .env.example dengan rahasia acak (POSTGRES_PASSWORD, JWT_STUDENT_SECRET,
# JWT_ADMIN_SECRET). Tidak menimpa .env yang sudah ada.
# Alamat akses (STUDENT_ADDRESS, ADMIN_ADDRESS, PUBLIC_*_URL) tetap harus Anda sunting sendiri.
set -eu
cd "$(dirname "$0")"

if [ -e .env ]; then
  echo ".env sudah ada -- tidak ditimpa (hapus dulu kalau ingin membuatnya ulang)."
  exit 0
fi

# 24 byte acak dalam heksadesimal: aman dipakai di URL database maupun sebagai kunci.
rand() { head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

umask 077 # .env berisi rahasia: hanya pemilik yang boleh membaca
sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rand)|" \
  -e "s|^JWT_STUDENT_SECRET=.*|JWT_STUDENT_SECRET=$(rand)|" \
  -e "s|^JWT_ADMIN_SECRET=.*|JWT_ADMIN_SECRET=$(rand)|" \
  .env.example > .env

echo "deploy/.env dibuat dengan rahasia acak."
echo "Sekarang sunting alamat akses di dalamnya (STUDENT_ADDRESS, ADMIN_ADDRESS, PUBLIC_STUDENT_URL, PUBLIC_ADMIN_URL)."
