/** Memeriksa database (DATABASE_URL) sebelum migrasi -- terutama untuk Postgres yang SUDAH ADA di server sendiri.
 *
 *   pnpm run db:check
 *   (Docker: docker compose run --rm tools pnpm run db:check)
 *
 * Menjelaskan bila alamat/kata sandi salah, server tak terjangkau, database tidak ada, pengguna tak berhak membuat tabel,
 * atau database sudah berisi tabel aplikasi lain (Prisma menolak: P3005). TIDAK mengubah apa pun. Kode keluar 1 bila migrasi
 * pasti gagal. Dijalankan juga otomatis di awal `pnpm run db:deploy`, jadi layanan `migrate` di deploy/ menampilkannya di log. */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  assessProbe,
  connectionFailureHint,
  describeTarget,
  formatReport,
  localMigrationNames,
  parseDatabaseUrl,
  probeDatabase,
  redactPassword,
  type SqlQuery,
} from "../src/bootstrap/db-check";

// Seperti `prisma db seed`, baca .env bila ada (di Docker environment datang dari compose dan berkas .env tidak ada di image).
try {
  process.loadEnvFile();
} catch {
  // tidak ada .env: pakai environment apa adanya
}

/** Galat Prisma memuat baris pembuka berisi potongan kode; ambil beberapa baris isinya saja. */
function firstLines(error: unknown, max = 4): string {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Invalid `prisma."))
    .slice(0, max)
    .join("\n  ");
}

async function main(): Promise<number> {
  const rawUrl = process.env.DATABASE_URL;
  const parsed = parseDatabaseUrl(rawUrl);
  if (!parsed.ok) {
    console.error(`GAGAL: ${parsed.problem}\n  → ${parsed.hint}`);
    return 1;
  }
  const { target } = parsed;

  const prisma = new PrismaClient();
  const query: SqlQuery = <T>(sql: string, ...params: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...params);
  try {
    const probe = await probeDatabase(query, target.schema);
    const local = localMigrationNames(readdirSync(join(__dirname, "migrations"), { withFileTypes: true }));
    const assessment = assessProbe(probe, target, local);
    for (const line of formatReport(target, probe, assessment)) {
      (line.startsWith("GAGAL") || line.startsWith("  →") ? console.error : console.log)(line);
    }
    return assessment.problems.length > 0 ? 1 : 0;
  } catch (error) {
    console.error(`GAGAL: tidak bisa memakai database ${describeTarget(target)}:\n  ${redactPassword(firstLines(error), rawUrl)}`);
    console.error(`  → ${connectionFailureHint(error, target)}`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
