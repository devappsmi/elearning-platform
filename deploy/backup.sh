#!/bin/sh
# Cadangan: dump database (format kustom pg_dump) + berkas audio (volume media_data) -> deploy/backup/<waktu>/.
# Jalankan dari server, di direktori mana pun. Pemulihan: docs/DEPLOY.md, bagian "Cadangan dan pemulihan".
# Isinya data pribadi (email, hash kata sandi): simpan di tempat yang aman, jangan di-commit.
set -eu
cd "$(dirname "$0")"

umask 077
DIR="backup/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"

docker compose exec -T postgres pg_dump -U elearning -d elearning -Fc > "$DIR/database.dump"
echo "database  -> $DIR/database.dump"

# Audio (volume media_data). Salinan langsung dari volume yang sedang dipakai cukup di sini: berkasnya ditulis atomik
# (temp lalu rename) dan tak pernah diubah sesudahnya, jadi tidak ada berkas setengah jadi; bisa dibuat ulang dari TTS.
docker run --rm -v elearning_media_data:/data:ro -v "$PWD/$DIR":/backup alpine tar czf /backup/media.tgz -C /data .
echo "audio     -> $DIR/media.tgz"

echo "selesai: $DIR"
