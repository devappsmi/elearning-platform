# Memulihkan cadangan ke schema aplikasi -- ke schema yang KOSONG atau belum ada (lihat docs/DEPLOY.md, "Cadangan dan pemulihan"):
#   docker compose run --rm -T --no-deps -v "$PWD/backup/<waktu>":/backup:ro pgclient /pg-restore.sh /backup/database.dump
# Sengaja TANPA --clean: pemulihan tidak pernah menghapus apa pun di database Anda; bila schema sudah berisi tabel yang sama,
# pg_restore melaporkan objek yang sudah ada dan tidak menimpanya (kosongkan schema dulu, langkahnya ada di panduan).
set -eu
. /pgurl.sh
FILE=${1:?pakai: pg-restore.sh /backup/database.dump}

# pg_restore --schema TIDAK membuat schema-nya, jadi buat dulu -- tetapi hanya bila BELUM ada: `CREATE SCHEMA IF NOT EXISTS` pun
# menuntut hak CREATE pada database, padahal schema yang disiapkan pengelola database sudah ada dan cukup dipakai.
EXISTS=$(printf "SELECT 1 FROM pg_namespace WHERE nspname = :'schema';\n" | psql -v schema="$SCHEMA" -At "$PGURL")
if [ -z "$EXISTS" ]; then
  printf 'CREATE SCHEMA :"schema";\n' | psql -v schema="$SCHEMA" -v ON_ERROR_STOP=1 -q "$PGURL"
fi

exec pg_restore --no-owner --no-privileges --schema="$SCHEMA" --dbname="$PGURL" "$FILE"
