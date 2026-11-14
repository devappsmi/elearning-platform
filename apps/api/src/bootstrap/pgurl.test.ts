import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// deploy/pgurl.sh dijalankan SUNGGUHAN dengan `sh`: mengubah DATABASE_URL gaya Prisma menjadi URL libpq (untuk pg_dump/pg_restore
// di container `pgclient`). Kesalahan di sini merusak cadangan tanpa terasa -- satu kasus sudah pernah terlewat (dua parameter khusus
// Prisma yang bersebelahan tidak keduanya terbuang) -- jadi bentuk-bentuk URL-nya dipatok di sini. Butuh `sh` (Linux/macOS/CI).

const SCRIPT = resolve(__dirname, "../../../../deploy/pgurl.sh");
const hasSh = spawnSync("sh", ["-c", "true"]).status === 0;

function run(databaseUrl: string | undefined) {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH };
  if (databaseUrl !== undefined) env.DATABASE_URL = databaseUrl;
  const result = spawnSync("sh", ["-c", '. "$1"; printf "%s\\n%s" "$SCHEMA" "$PGURL"', "sh", SCRIPT], { env, encoding: "utf8" });
  const [schema, pgurl] = result.stdout.split("\n");
  return { status: result.status, schema, pgurl, stderr: result.stderr };
}

const BASE = "postgresql://elearning_app:Pa%40ss%3Aw%2Frd%231%25@host.docker.internal:5433/elearning";

describe.skipIf(!hasSh)("deploy/pgurl.sh", () => {
  it.each([
    ["tanpa parameter", "", "public", BASE],
    ["?schema= saja", "?schema=elearning", "elearning", BASE],
    ["sslmode diteruskan, schema dibuang (schema di belakang)", "?sslmode=require&schema=elearning", "elearning", `${BASE}?sslmode=require`],
    ["sslmode diteruskan, schema dibuang (schema di depan)", "?schema=elearning&sslmode=require", "elearning", `${BASE}?sslmode=require`],
    ["DUA parameter khusus Prisma BERSEBELAHAN terbuang semua", "?sslaccept=accept_invalid_certs&schema=x&sslmode=require", "x", `${BASE}?sslmode=require`],
    ["semua parameter khusus Prisma terbuang", "?schema=a&connection_limit=5&pool_timeout=10&pgbouncer=true&statement_cache_size=0&socket_timeout=5", "a", BASE],
    ["opsi sertifikat klien Prisma tidak diteruskan (artinya beda di libpq)", "?sslcert=/x.pem&sslidentity=/y.p12&sslpassword=z&sslmode=require", "public", `${BASE}?sslmode=require`],
    ["parameter yang dikenal libpq dipertahankan (connect_timeout, application_name)", "?connect_timeout=5&schema=a&application_name=elearning", "a", `${BASE}?connect_timeout=5&application_name=elearning`],
    ["hanya parameter Prisma: tanda tanya ikut hilang", "?pgbouncer=true", "public", BASE],
    ["tanda tanya kosong dan & berlebih", "?&schema=a&", "a", BASE],
    ["'&&' di tengah (parameter kosong) tidak menyisakan '&&' pada URL hasil", "?sslmode=require&&connect_timeout=5", "public", `${BASE}?sslmode=require&connect_timeout=5`],
  ])("%s", (_nama, query, schema, pgurl) => {
    const result = run(`${BASE}${query}`);

    expect(result.status).toBe(0);
    expect({ schema: result.schema, pgurl: result.pgurl }).toEqual({ schema, pgurl });
  });

  it("kata sandi ter-encode dan nama pengguna tidak diubah sama sekali", () => {
    expect(run(`${BASE}?schema=x`).pgurl).toContain("elearning_app:Pa%40ss%3Aw%2Frd%231%25@host.docker.internal:5433/elearning");
  });

  it("tanpa DATABASE_URL: berhenti dengan pesan yang menyebutnya", () => {
    const result = run(undefined);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("DATABASE_URL kosong");
  });
});
