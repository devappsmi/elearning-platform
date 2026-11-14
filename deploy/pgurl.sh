# Dibaca (`. /pgurl.sh`) oleh pg-dump.sh dan pg-restore.sh di dalam container `pgclient` (deploy/docker-compose.yml).
#
# DATABASE_URL memakai gaya Prisma. Alat Postgres (pg_dump/pg_restore, libpq) menolak parameter khusus Prisma
# ("invalid URI query parameter"), jadi parameter itu dibuang: schema, sslaccept, sslcert, sslidentity, sslpassword,
# connection_limit, pool_timeout, pgbouncer, statement_cache_size, socket_timeout. Parameter lain (sslmode, connect_timeout,
# application_name, ...) diteruskan apa adanya, jadi TLS ke server memakai sslmode dari URL saja. ?schema= dibaca terpisah
# (bawaan `public`): cadangan dan pemulihan dibatasi pada schema aplikasi ini -- tabel aplikasi lain di database yang sama
# tidak disentuh. Hasil: $SCHEMA dan $PGURL. Diuji: apps/api/src/bootstrap/pgurl.test.ts.
: "${DATABASE_URL:?DATABASE_URL kosong}"

SCHEMA=$(printf '%s' "$DATABASE_URL" | sed -nE 's/.*[?&]schema=([^&]*).*/\1/p')
SCHEMA=${SCHEMA:-public}

PGURL=$(printf '%s' "$DATABASE_URL" | awk '
  {
    q = index($0, "?")
    if (q == 0) { print $0; next }
    base = substr($0, 1, q - 1)
    n = split(substr($0, q + 1), parts, "&")
    out = ""
    for (i = 1; i <= n; i++) {
      split(parts[i], kv, "=")
      if (parts[i] == "" || kv[1] ~ /^(schema|sslaccept|sslcert|sslidentity|sslpassword|connection_limit|pool_timeout|pgbouncer|statement_cache_size|socket_timeout)$/) continue
      out = (out == "" ? parts[i] : out "&" parts[i])
    }
    print (out == "" ? base : base "?" out)
  }')
