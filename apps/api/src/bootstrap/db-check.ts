/** Pemeriksaan sebelum migrasi untuk Postgres yang SUDAH ADA (server sendiri) -- dijalankan `pnpm run db:check` dan
 * otomatis di awal `pnpm run db:deploy` (prisma/db-check.ts, lihat docs/DEPLOY.md). Tujuannya mengganti galat mentah Prisma
 * yang membingungkan (mis. "P1013 invalid port number" untuk kata sandi yang belum di-encode, "P3005" untuk database yang
 * sudah berisi tabel lain, "Schema engine error:" tanpa keterangan) dengan pesan yang menyebut penyebab dan tindakannya.
 * Logika ada di sini (bukan di skripnya) supaya teruji tanpa database. */

export interface DatabaseTarget {
  host: string;
  port: string;
  database: string;
  user: string;
  /** Parameter `?schema=` gaya Prisma (bawaan `public`). */
  schema: string;
}

export type ParsedDatabaseUrl = { ok: true; target: DatabaseTarget } | { ok: false; problem: string; hint: string };

export const ENCODE_HINT =
  "Karakter khusus di nama pengguna/kata sandi harus di-encode: @ → %40, : → %3A, / → %2F, ? → %3F, # → %23, % → %25, $ → %24, spasi → %20 " +
  "(contoh: kata sandi p@ss/1 ditulis p%40ss%2F1).";

const URL_FORMAT = "postgresql://PENGGUNA:KATA_SANDI@HOST:5432/NAMA_DATABASE";

/** Membaca DATABASE_URL dan menolaknya dengan penjelasan bila bentuknya salah -- SEBELUM Prisma mencoba terhubung. */
export function parseDatabaseUrl(raw: string | undefined): ParsedDatabaseUrl {
  const value = raw?.trim();
  if (!value) {
    return { ok: false, problem: "DATABASE_URL kosong.", hint: `Isi DATABASE_URL di deploy/.env, bentuknya ${URL_FORMAT}` };
  }
  if (value.includes("GANTI")) {
    return {
      ok: false,
      problem: "DATABASE_URL masih berisi contoh (GANTI-…).",
      hint: `Ganti dengan alamat Postgres Anda: ${URL_FORMAT}`,
    };
  }
  if (!/^postgres(ql)?:\/\//i.test(value)) {
    return { ok: false, problem: "DATABASE_URL harus diawali postgresql://", hint: `Bentuknya ${URL_FORMAT}` };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, problem: "DATABASE_URL tidak bisa dibaca (alamat, port, atau kata sandi tidak sesuai bentuk URL).", hint: ENCODE_HINT };
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname) return { ok: false, problem: "DATABASE_URL tidak memuat nama host.", hint: `Bentuknya ${URL_FORMAT}` };
  if (!database) return { ok: false, problem: "DATABASE_URL tidak memuat nama database (bagian setelah host:port/).", hint: `Bentuknya ${URL_FORMAT}` };

  return {
    ok: true,
    target: {
      host: url.hostname,
      port: url.port || "5432",
      database,
      user: decodeURIComponent(url.username),
      schema: url.searchParams.get("schema")?.trim() || "public",
    },
  };
}

/** Ringkasan tujuan untuk log -- TANPA kata sandi. */
export function describeTarget(target: DatabaseTarget): string {
  return `${target.host}:${target.port}/${target.database} (schema "${target.schema}", pengguna "${target.user}")`;
}

/** Hasil pemeriksaan ke server. */
export interface DbProbe {
  serverVersion: string;
  schemaExists: boolean;
  /** Jumlah tabel/view/objek relasi di schema, tidak termasuk `_prisma_migrations`. */
  relationCount: number;
  migrationsTable: boolean;
  appliedMigrations: string[];
  /** Hak CREATE: pada schema bila schema sudah ada, kalau belum pada database. null = tak bisa ditentukan. */
  canCreate: boolean | null;
  /** null = tak bisa ditentukan (mis. tampilan statistik SSL tak boleh dibaca). */
  tls: boolean | null;
}

export type SqlQuery = <T>(sql: string, ...params: unknown[]) => Promise<T[]>;

/** Nama identifier SQL yang aman (schema berasal dari URL milik operator sendiri, tetap di-quote dengan benar). */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function probeDatabase(query: SqlQuery, schema: string): Promise<DbProbe> {
  const [info] = await query<{ version: string }>("SELECT version() AS version");
  const [ns] = await query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS exists", schema);
  const schemaExists = Boolean(ns?.exists);

  let relationCount = 0;
  let migrationsTable = false;
  let appliedMigrations: string[] = [];
  if (schemaExists) {
    const [rel] = await query<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
        "WHERE n.nspname = $1 AND c.relkind IN ('r','p','v','m','f') AND c.relname <> '_prisma_migrations'",
      schema,
    );
    relationCount = rel?.n ?? 0;
    const [mt] = await query<{ ok: boolean }>("SELECT to_regclass($1) IS NOT NULL AS ok", `${quoteIdent(schema)}._prisma_migrations`);
    migrationsTable = Boolean(mt?.ok);
    if (migrationsTable) {
      const rows = await query<{ migration_name: string }>(`SELECT migration_name FROM ${quoteIdent(schema)}."_prisma_migrations" ORDER BY migration_name`);
      appliedMigrations = rows.map((r) => r.migration_name);
    }
  }

  let canCreate: boolean | null = null;
  try {
    const [priv] = schemaExists
      ? await query<{ ok: boolean }>("SELECT has_schema_privilege(current_user, $1, 'CREATE') AS ok", schema)
      : await query<{ ok: boolean }>("SELECT has_database_privilege(current_user, current_database(), 'CREATE') AS ok");
    canCreate = priv?.ok ?? null;
  } catch {
    canCreate = null;
  }

  let tls: boolean | null = null;
  try {
    const [ssl] = await query<{ ssl: boolean }>("SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()");
    tls = ssl?.ssl ?? null;
  } catch {
    tls = null;
  }

  return { serverVersion: info?.version ?? "?", schemaExists, relationCount, migrationsTable, appliedMigrations, canCreate, tls };
}

export interface Problem {
  message: string;
  hint: string;
}

export interface Assessment {
  /** Ringkasan keadaan schema. */
  state: string;
  /** Yang MENGHALANGI migrasi. */
  problems: Problem[];
  /** Layak diketahui tetapi tidak menghalangi. */
  warnings: string[];
}

const DEDICATED_HINT =
  "Pakai database KHUSUS untuk aplikasi ini (disarankan), atau schema khusus: tambahkan ?schema=elearning di ujung DATABASE_URL " +
  "(schema dibuat otomatis bila pengguna berhak CREATE pada database; tabel aplikasi lain tidak disentuh).";

/** Menilai apakah `prisma migrate deploy` akan berhasil di database ini -- dan menjelaskan bila tidak. */
export function assessProbe(probe: DbProbe, target: DatabaseTarget, localMigrations: readonly string[]): Assessment {
  const problems: Problem[] = [];
  const warnings: string[] = [];
  const schema = quoteIdent(target.schema);
  const user = quoteIdent(target.user);

  let state: string;
  if (!probe.schemaExists) state = `schema "${target.schema}" belum ada (dibuat saat migrasi pertama)`;
  else if (probe.migrationsTable) state = `sudah dikelola aplikasi ini (${probe.appliedMigrations.length} migrasi tercatat)`;
  else if (probe.relationCount === 0) state = "kosong -- siap dimigrasi";
  else state = `berisi ${probe.relationCount} objek tanpa riwayat migrasi`;

  if (probe.schemaExists && !probe.migrationsTable && probe.relationCount > 0) {
    problems.push({
      message: `schema "${target.schema}" sudah berisi ${probe.relationCount} tabel/objek lain dan belum dikelola aplikasi ini -- Prisma menolak migrasi (P3005).`,
      hint: DEDICATED_HINT,
    });
  }

  if (probe.migrationsTable) {
    const local = new Set(localMigrations);
    const foreign = probe.appliedMigrations.filter((name) => !local.has(name));
    const shared = probe.appliedMigrations.length - foreign.length;
    if (foreign.length > 0 && shared === 0) {
      problems.push({
        message: `riwayat migrasi di schema "${target.schema}" milik aplikasi Prisma LAIN (mis. ${foreign[0]}) -- tidak satu pun migrasi aplikasi ini tercatat.`,
        hint: DEDICATED_HINT,
      });
    } else if (foreign.length > 0) {
      warnings.push(
        `${foreign.length} migrasi tercatat di database ini tidak ada di kode yang sedang dijalankan (mis. ${foreign[0]}): database lebih baru daripada kode -- pastikan kode tidak mundur versi.`,
      );
    }
  }

  if (probe.canCreate === false) {
    const where = probe.schemaExists ? `schema ${schema}` : "database ini";
    const hint = probe.schemaExists
      ? `Minta pengelola database menjalankan: GRANT ALL ON SCHEMA ${schema} TO ${user};  (atau jadikan ${user} pemilik database).`
      : `Minta pengelola database menjalankan: CREATE SCHEMA ${schema} AUTHORIZATION ${user};  (atau GRANT CREATE ON DATABASE ${quoteIdent(target.database)} TO ${user};).`;
    if (probe.migrationsTable) {
      warnings.push(`pengguna "${target.user}" tidak berhak CREATE pada ${where}: migrasi BARU di masa depan akan gagal. ${hint}`);
    } else {
      problems.push({ message: `pengguna "${target.user}" tidak berhak membuat tabel di ${where} -- migrasi pertama akan gagal ("permission denied").`, hint });
    }
  }

  if (probe.tls === false && target.host !== "postgres") {
    warnings.push(
      "koneksi ke server ini TIDAK terenkripsi (TLS). Bila lewat jaringan yang tak sepenuhnya Anda kuasai, tambahkan ?sslmode=require di ujung DATABASE_URL (server harus mendukung TLS).",
    );
  }

  return { state, problems, warnings };
}

/** Baris laporan untuk dicetak. */
export function formatReport(target: DatabaseTarget, probe: DbProbe, assessment: Assessment): string[] {
  const lines = [
    `Database : ${probe.serverVersion.split(",")[0]} di ${describeTarget(target)}`,
    `TLS      : ${probe.tls === null ? "tidak diketahui" : probe.tls ? "ya" : "tidak"}`,
    `Schema   : ${assessment.state}`,
  ];
  for (const warning of assessment.warnings) lines.push(`PERHATIAN: ${warning}`);
  for (const problem of assessment.problems) lines.push(`GAGAL: ${problem.message}`, `  → ${problem.hint}`);
  return lines;
}

/** Nama migrasi milik kode ini = nama direktori di prisma/migrations. */
export function localMigrationNames(entries: readonly { name: string; isDirectory: () => boolean }[]): string[] {
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

/** Menghapus kata sandi dari teks galat sebelum dicetak (galat Prisma jarang memuatnya, tetapi log tidak boleh menyimpannya). */
export function redactPassword(text: string, rawUrl: string | undefined): string {
  let out = text.replace(/(postgres(?:ql)?:\/\/[^:/@\s]*:)[^@\s]*@/gi, "$1***@");
  const match = rawUrl ? /^postgres(?:ql)?:\/\/[^:/@]*:(.*)@[^@]*$/is.exec(rawUrl.split("?")[0]!) : null;
  const password = match?.[1];
  if (password && password.length >= 3) {
    for (const variant of new Set([password, safeDecode(password)])) if (variant) out = out.split(variant).join("***");
  }
  return out;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Galat koneksi Prisma pada query pertama (`PrismaClientInitializationError`) TIDAK membawa kode di properti `code`/`errorCode`
 * maupun di teksnya -- yang ada hanya kalimat khasnya. Jadi kode P10xx diturunkan dari kalimat itu (diamati langsung terhadap
 * Prisma 6 di image deploy), dengan kode eksplisit lebih diutamakan bila ada. */
const MESSAGE_CODES: [RegExp, string][] = [
  [/can't reach database server/i, "P1001"],
  [/authentication failed against database server/i, "P1000"],
  [/reached but timed out/i, "P1002"],
  [/database [`"'].+[`"'] does not exist/i, "P1003"],
  [/denied access on the database/i, "P1010"],
  [/error opening a tls connection/i, "P1011"],
  [/provided database string is invalid/i, "P1013"],
];

function failureCode(error: unknown, text: string): string | undefined {
  const props = error as { errorCode?: unknown; code?: unknown } | null;
  for (const candidate of [props?.errorCode, props?.code]) {
    if (typeof candidate === "string" && /^P\d{4}$/.test(candidate)) return candidate;
  }
  return /\bP\d{4}\b/.exec(text)?.[0] ?? MESSAGE_CODES.find(([pattern]) => pattern.test(text))?.[1];
}

/** Penjelasan untuk galat koneksi Prisma (kode dari properti galat, teks, atau kalimat khasnya). */
export function connectionFailureHint(error: unknown, target?: DatabaseTarget): string {
  const text = error instanceof Error ? error.message : String(error);
  const code = failureCode(error, text);

  switch (code) {
    case "P1000":
      return (
        "Nama pengguna atau kata sandi ditolak server. Periksa DATABASE_URL (kata sandi berkarakter khusus harus di-encode: " +
        "@ → %40, : → %3A, / → %2F, # → %23, % → %25, $ → %24) dan pastikan pengguna itu ada di server."
      );
    case "P1001": {
      const local = target && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.host);
      return (
        (local
          ? `"${target?.host}" di dalam container adalah container itu sendiri, BUKAN mesin server. Untuk Postgres di mesin yang sama pakai host.docker.internal ` +
            "(sudah tersedia di stack ini) atau IP mesin itu; untuk server lain pakai nama/IP-nya. "
          : "") +
        "Server tidak terjangkau: periksa host dan port, firewall, listen_addresses di postgresql.conf, dan pg_hba.conf (harus mengizinkan alamat container ini)."
      );
    }
    case "P1002":
      return "Server ada tetapi tidak menjawab tepat waktu: periksa beban server, firewall, dan pengaturan jaringan.";
    case "P1003":
      return "Database itu tidak ada di server. Buat dulu (CREATE DATABASE ...) atau perbaiki nama database di DATABASE_URL.";
    case "P1010":
      return "Server menolak akses pengguna ini ke database tersebut: periksa hak CONNECT dan pg_hba.conf, dan apakah server mewajibkan TLS (tambahkan ?sslmode=require).";
    case "P1011":
      return "Gagal membuka koneksi TLS: periksa dukungan TLS di server dan parameter sslmode pada DATABASE_URL.";
    case "P1013":
      return `DATABASE_URL tidak valid menurut Prisma. ${ENCODE_HINT}`;
    default:
      break;
  }
  if (/permission denied/i.test(text)) return "Pengguna ini tidak berhak melakukan operasi itu: lihat hak CREATE pada schema/database (docs/DEPLOY.md, bagian 2a).";
  return "Lihat pesan galat di atas dan docs/DEPLOY.md, bagian 2a.";
}
