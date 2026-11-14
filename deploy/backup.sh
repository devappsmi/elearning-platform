#!/bin/sh
# Cadangan: dump database (format kustom pg_dump, hanya schema aplikasi) + berkas audio (volume media_data)
# -> deploy/backup/<waktu>/. Database = yang ditunjuk DATABASE_URL di .env (Postgres sendiri ATAU bawaan).
# Jalankan dari server, di direktori mana pun. Pemulihan: docs/DEPLOY.md, bagian "Cadangan dan pemulihan".
# Isinya data pribadi (email, hash kata sandi): simpan di tempat yang aman, jangan di-commit.
set -eu
cd "$(dirname "$0")"

umask 077
DIR="backup/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"

# pg_dump dijalankan di container `pgclient` dengan DATABASE_URL yang sama dengan API (lihat pgurl.sh). Server Postgres
# yang lebih baru daripada klien bawaan (17) menolaknya: setel PG_CLIENT_IMAGE di .env (mis. postgres:18-alpine).
if ! docker compose run --rm -T --no-deps pgclient /pg-dump.sh > "$DIR/database.dump"; then
  rm -f "$DIR/database.dump"
  rmdir "$DIR" 2>/dev/null || true
  echo "GAGAL: pg_dump tidak berhasil (lihat pesan di atas). Cadangan audio TIDAK dibuat." >&2
  exit 1
fi
[ -s "$DIR/database.dump" ] || { echo "GAGAL: database.dump kosong." >&2; exit 1; }
echo "database  -> $DIR/database.dump"

# Audio (volume media_data). Salinan langsung dari volume yang sedang dipakai cukup di sini: berkasnya ditulis atomik
# (temp lalu rename) dan tak pernah diubah sesudahnya, jadi tidak ada berkas setengah jadi; bisa dibuat ulang dari TTS.
docker run --rm -v elearning_media_data:/data:ro -v "$PWD/$DIR":/backup alpine tar czf /backup/media.tgz -C /data .
echo "audio     -> $DIR/media.tgz"

echo "selesai: $DIR"
