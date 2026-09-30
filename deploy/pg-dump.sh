# Mencetak cadangan schema aplikasi (format kustom pg_dump) ke stdout. Dijalankan lewat backup.sh:
#   docker compose run --rm -T --no-deps pgclient /pg-dump.sh > database.dump
set -eu
. /pgurl.sh
exec pg_dump --format=custom --schema="$SCHEMA" "$PGURL"
