#!/bin/sh
# Cadangan: dump database (format kustom pg_dump) + isi penyimpanan audio bawaan -> deploy/backup/<waktu>/.
# Jalankan dari server, di direktori mana pun. Pemulihan: docs/DEPLOY.md, bagian "Cadangan dan pemulihan".
# Isinya data pribadi (email, hash kata sandi): simpan di tempat yang aman, jangan di-commit.
set -eu
cd "$(dirname "$0")"

umask 077
DIR="backup/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"

docker compose exec -T postgres pg_dump -U elearning -d elearning -Fc > "$DIR/database.dump"
echo "database  -> $DIR/database.dump"

# Penyimpanan audio: hanya bila layanan bawaan berjalan. Salinan langsung dari volume yang sedang dipakai
# cukup di sini karena isinya berkas audio yang tak pernah diubah setelah ditulis (dan bisa dibuat ulang).
if docker compose ps --status running --services 2>/dev/null | grep -qx storage; then
  docker run --rm -v elearning_storage_data:/data:ro -v "$PWD/$DIR":/backup alpine tar czf /backup/storage.tgz -C /data .
  echo "audio     -> $DIR/storage.tgz"
fi

echo "selesai: $DIR"
