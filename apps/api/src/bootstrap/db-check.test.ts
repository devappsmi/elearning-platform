import { describe, expect, it } from "vitest";
import {
  ENCODE_HINT,
  assessProbe,
  connectionFailureHint,
  describeTarget,
  formatReport,
  localMigrationNames,
  parseDatabaseUrl,
  probeDatabase,
  quoteIdent,
  redactPassword,
  type DatabaseTarget,
  type DbProbe,
  type SqlQuery,
} from "./db-check";

const TARGET: DatabaseTarget = { host: "db.contoh.id", port: "5432", database: "elearning", user: "elearning_app", schema: "public" };
const LOCAL = ["20260927095024_init", "20260927095515_vocab_meaning_id_nullable", "20260929053000_emails_lowercase"];

function probe(overrides: Partial<DbProbe> = {}): DbProbe {
  return {
    serverVersion: "PostgreSQL 17.11 on x86_64-pc-linux-musl, compiled by gcc",
    schemaExists: true,
    relationCount: 0,
    migrationsTable: false,
    appliedMigrations: [],
    canCreate: true,
    tls: true,
    ...overrides,
  };
}

describe("parseDatabaseUrl", () => {
  it("URL lengkap dengan kata sandi ter-encode: host, port, database, pengguna (di-decode), schema bawaan public", () => {
    const parsed = parseDatabaseUrl("postgresql://elearning_app:Pa%40ss%3Aw%2Frd%231%25@host.docker.internal:5433/elearning_ext");

    expect(parsed).toEqual({
      ok: true,
      target: { host: "host.docker.internal", port: "5433", database: "elearning_ext", user: "elearning_app", schema: "public" },
    });
  });

  it("?schema= dibaca; parameter lain (sslmode) tidak mengganggu", () => {
    const parsed = parseDatabaseUrl("postgresql://u:p@h:5432/d?sslmode=require&schema=elearning");

    expect(parsed).toMatchObject({ ok: true, target: { schema: "elearning" } });
  });

  it("port bawaan 5432; skema postgres:// juga diterima; spasi di ujung dipangkas", () => {
    expect(parseDatabaseUrl("  postgres://u:p@h/d  ")).toMatchObject({ ok: true, target: { host: "h", port: "5432", database: "d" } });
  });

  it("host IPv6 dan nama pengguna ber-encode terbaca", () => {
    expect(parseDatabaseUrl("postgresql://us%40er:p@[::1]:5432/d")).toMatchObject({ ok: true, target: { host: "[::1]", user: "us@er" } });
  });

  it.each([undefined, "", "   "])("DATABASE_URL %j -> galat 'kosong' dengan bentuk yang benar", (raw) => {
    const parsed = parseDatabaseUrl(raw);

    expect(parsed).toMatchObject({ ok: false, problem: "DATABASE_URL kosong." });
    expect((parsed as { hint: string }).hint).toContain("postgresql://PENGGUNA:KATA_SANDI@HOST:5432/NAMA_DATABASE");
  });

  it("contoh bawaan .env.example (GANTI-…) ditolak sebelum mencoba terhubung", () => {
    const parsed = parseDatabaseUrl("postgresql://GANTI-USER:GANTI-PASSWORD@GANTI-HOST:5432/GANTI-DB");

    expect(parsed).toMatchObject({ ok: false, problem: "DATABASE_URL masih berisi contoh (GANTI-…)." });
  });

  it("bukan postgresql:// -> galat", () => {
    expect(parseDatabaseUrl("mysql://u:p@h:3306/d")).toMatchObject({ ok: false, problem: "DATABASE_URL harus diawali postgresql://" });
  });

  it("kata sandi berkarakter khusus TANPA encode (/, #) -> tidak terbaca, dan petunjuknya adalah cara encode", () => {
    const parsed = parseDatabaseUrl("postgresql://elearning_app:Pa@ss:w/rd#1%@host.docker.internal:5433/elearning_ext");

    expect(parsed).toMatchObject({ ok: false, hint: ENCODE_HINT });
  });

  it("port bukan angka -> tidak terbaca dengan petunjuk encode", () => {
    expect(parseDatabaseUrl("postgresql://u:p@h:abc/d")).toMatchObject({ ok: false, hint: ENCODE_HINT });
  });

  it("tanpa nama database -> galat yang menyebutnya", () => {
    expect(parseDatabaseUrl("postgresql://u:p@h:5432")).toMatchObject({ ok: false, problem: expect.stringContaining("nama database") });
    expect(parseDatabaseUrl("postgresql://u:p@h:5432/")).toMatchObject({ ok: false, problem: expect.stringContaining("nama database") });
  });

  it("describeTarget TIDAK pernah memuat kata sandi", () => {
    const parsed = parseDatabaseUrl("postgresql://elearning_app:rahasia-sekali@db.contoh.id:5432/elearning");

    expect(parsed.ok && describeTarget(parsed.target)).toBe('db.contoh.id:5432/elearning (schema "public", pengguna "elearning_app")');
    expect(JSON.stringify(parsed)).not.toContain("rahasia-sekali");
  });
});

describe("quoteIdent", () => {
  it("membungkus dengan tanda kutip ganda dan menggandakan tanda kutip di dalamnya", () => {
    expect(quoteIdent("elearning")).toBe('"elearning"');
    expect(quoteIdent('a"b')).toBe('"a""b"');
  });
});

describe("probeDatabase (SQL yang dijalankan)", () => {
  /** Query palsu: mencocokkan potongan SQL -> baris. Mencatat semua panggilan. */
  function scripted(answers: [needle: string, rows: unknown[] | Error][]) {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query: SqlQuery = async <T>(sql: string, ...params: unknown[]) => {
      calls.push({ sql, params });
      const hit = answers.find(([needle]) => sql.includes(needle));
      if (!hit) throw new Error(`query tak terduga: ${sql}`);
      if (hit[1] instanceof Error) throw hit[1];
      return hit[1] as T[];
    };
    return { query, calls };
  }

  it("schema belum ada: tidak memeriksa tabel/migrasi, hak CREATE diperiksa pada DATABASE", async () => {
    const { query, calls } = scripted([
      ["version()", [{ version: "PostgreSQL 16.2" }]],
      ["FROM pg_namespace WHERE", [{ exists: false }]],
      ["has_database_privilege", [{ ok: true }]],
      ["pg_stat_ssl", [{ ssl: false }]],
    ]);

    const result = await probeDatabase(query, "elearning");

    expect(result).toEqual({
      serverVersion: "PostgreSQL 16.2",
      schemaExists: false,
      relationCount: 0,
      migrationsTable: false,
      appliedMigrations: [],
      canCreate: true,
      tls: false,
    });
    expect(calls.some((c) => c.sql.includes("pg_class"))).toBe(false);
    expect(calls.find((c) => c.sql.includes("pg_namespace"))!.params).toEqual(["elearning"]);
  });

  it("schema ada dan dikelola: membaca jumlah objek, daftar migrasi (schema di-quote), hak CREATE pada SCHEMA", async () => {
    const { query, calls } = scripted([
      ["version()", [{ version: "PostgreSQL 17.11" }]],
      ["FROM pg_namespace WHERE", [{ exists: true }]],
      ["FROM pg_class", [{ n: 25 }]],
      ["to_regclass", [{ ok: true }]],
      ['FROM "elearning"."_prisma_migrations"', [{ migration_name: "a" }, { migration_name: "b" }]],
      ["has_schema_privilege", [{ ok: false }]],
      ["pg_stat_ssl", [{ ssl: true }]],
    ]);

    const result = await probeDatabase(query, "elearning");

    expect(result).toMatchObject({ schemaExists: true, relationCount: 25, migrationsTable: true, appliedMigrations: ["a", "b"], canCreate: false, tls: true });
    expect(calls.find((c) => c.sql.includes("to_regclass"))!.params).toEqual(['"elearning"._prisma_migrations']);
    expect(calls.find((c) => c.sql.includes("has_schema_privilege"))!.params).toEqual(["elearning"]);
  });

  it("schema ada tanpa tabel migrasi: daftar migrasi tidak dibaca", async () => {
    const { query, calls } = scripted([
      ["version()", [{ version: "PostgreSQL 17.11" }]],
      ["FROM pg_namespace WHERE", [{ exists: true }]],
      ["FROM pg_class", [{ n: 3 }]],
      ["to_regclass", [{ ok: false }]],
      ["has_schema_privilege", [{ ok: true }]],
      ["pg_stat_ssl", [{ ssl: true }]],
    ]);

    const result = await probeDatabase(query, "public");

    expect(result).toMatchObject({ relationCount: 3, migrationsTable: false, appliedMigrations: [] });
    expect(calls.some((c) => c.sql.includes("_prisma_migrations\" ORDER"))).toBe(false);
  });

  it("pemeriksaan opsional (hak, TLS) yang gagal dibaca menjadi null -- bukan menggagalkan pemeriksaan", async () => {
    const { query } = scripted([
      ["version()", [{ version: "PostgreSQL 17.11" }]],
      ["FROM pg_namespace WHERE", [{ exists: false }]],
      ["has_database_privilege", new Error("permission denied for function")],
      ["pg_stat_ssl", new Error("relation pg_stat_ssl does not exist")],
    ]);

    const result = await probeDatabase(query, "public");

    expect(result).toMatchObject({ canCreate: null, tls: null });
  });

  it("galat koneksi pada query PERTAMA merambat ke pemanggil (dijelaskan connectionFailureHint)", async () => {
    const boom = Object.assign(new Error("Can't reach database server"), { errorCode: "P1001" });
    const { query } = scripted([["version()", boom]]);

    await expect(probeDatabase(query, "public")).rejects.toBe(boom);
  });
});

describe("assessProbe", () => {
  it("database kosong: siap dimigrasi, tanpa masalah", () => {
    const result = assessProbe(probe(), TARGET, LOCAL);

    expect(result).toEqual({ state: "kosong -- siap dimigrasi", problems: [], warnings: [] });
  });

  it("schema belum ada tetapi pengguna berhak CREATE pada database: layak (dibuat saat migrasi)", () => {
    const result = assessProbe(probe({ schemaExists: false }), { ...TARGET, schema: "elearning" }, LOCAL);

    expect(result.problems).toEqual([]);
    expect(result.state).toContain('schema "elearning" belum ada');
  });

  it("sudah dikelola dengan semua migrasi milik kode ini: layak, jumlah migrasi tampil", () => {
    const result = assessProbe(probe({ migrationsTable: true, relationCount: 24, appliedMigrations: LOCAL }), TARGET, LOCAL);

    expect(result).toEqual({ state: "sudah dikelola aplikasi ini (3 migrasi tercatat)", problems: [], warnings: [] });
  });

  it("berisi tabel LAIN tanpa riwayat migrasi -> masalah P3005 dengan dua jalan keluar (database khusus / ?schema=)", () => {
    const result = assessProbe(probe({ relationCount: 4 }), TARGET, LOCAL);

    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]!.message).toContain('schema "public" sudah berisi 4 tabel/objek lain');
    expect(result.problems[0]!.message).toContain("P3005");
    expect(result.problems[0]!.hint).toContain("database KHUSUS");
    expect(result.problems[0]!.hint).toContain("?schema=elearning");
  });

  it("dikelola tetapi berisi juga tabel lain: aman (hidup berdampingan), tanpa masalah", () => {
    const result = assessProbe(probe({ migrationsTable: true, relationCount: 40, appliedMigrations: LOCAL }), TARGET, LOCAL);

    expect(result.problems).toEqual([]);
  });

  it("riwayat migrasi milik aplikasi Prisma LAIN (tak satu pun cocok) -> masalah", () => {
    const result = assessProbe(probe({ migrationsTable: true, relationCount: 8, appliedMigrations: ["20250101_init_aplikasi_lain"] }), TARGET, LOCAL);

    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]!.message).toContain("aplikasi Prisma LAIN");
    expect(result.problems[0]!.message).toContain("20250101_init_aplikasi_lain");
  });

  it("database lebih BARU daripada kode (sebagian migrasi tak dikenal, sebagian cocok) -> hanya peringatan", () => {
    const result = assessProbe(probe({ migrationsTable: true, appliedMigrations: [...LOCAL, "20261001_fitur_baru"] }), TARGET, LOCAL);

    expect(result.problems).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("20261001_fitur_baru");
    expect(result.warnings[0]).toContain("mundur versi");
  });

  it("belum dikelola dan pengguna tak berhak CREATE pada schema -> masalah dengan GRANT yang tepat (nama di-quote)", () => {
    const result = assessProbe(probe({ canCreate: false }), TARGET, LOCAL);

    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]!.message).toContain('pengguna "elearning_app" tidak berhak membuat tabel di schema "public"');
    expect(result.problems[0]!.hint).toContain('GRANT ALL ON SCHEMA "public" TO "elearning_app"');
  });

  it("schema belum ada dan pengguna tak berhak CREATE pada database -> hint CREATE SCHEMA / GRANT CREATE ON DATABASE", () => {
    const result = assessProbe(probe({ schemaExists: false, canCreate: false }), { ...TARGET, schema: "elearning" }, LOCAL);

    expect(result.problems[0]!.hint).toContain('CREATE SCHEMA "elearning" AUTHORIZATION "elearning_app"');
    expect(result.problems[0]!.hint).toContain('GRANT CREATE ON DATABASE "elearning" TO "elearning_app"');
  });

  it("sudah dikelola tetapi tak berhak CREATE -> hanya peringatan (aplikasi tetap bisa berjalan; migrasi baru yang akan gagal)", () => {
    const result = assessProbe(probe({ migrationsTable: true, appliedMigrations: LOCAL, canCreate: false }), TARGET, LOCAL);

    expect(result.problems).toEqual([]);
    expect(result.warnings[0]).toContain("migrasi BARU di masa depan akan gagal");
  });

  it("hak tak bisa ditentukan (null) -> tidak ada masalah maupun peringatan", () => {
    expect(assessProbe(probe({ canCreate: null, tls: null }), TARGET, LOCAL)).toMatchObject({ problems: [], warnings: [] });
  });

  it("TLS tidak dipakai ke server luar -> peringatan menyebut ?sslmode=require; ke layanan bawaan `postgres` tidak", () => {
    expect(assessProbe(probe({ tls: false }), TARGET, LOCAL).warnings[0]).toContain("?sslmode=require");
    expect(assessProbe(probe({ tls: false }), { ...TARGET, host: "postgres" }, LOCAL).warnings).toEqual([]);
    expect(assessProbe(probe({ tls: true }), TARGET, LOCAL).warnings).toEqual([]);
  });
});

describe("formatReport", () => {
  it("ringkasan tujuan tanpa kata sandi, versi server dipotong di koma, GAGAL dan petunjuknya berurutan", () => {
    const p = probe({ relationCount: 2 });
    const lines = formatReport(TARGET, p, assessProbe(p, TARGET, LOCAL));

    expect(lines[0]).toBe('Database : PostgreSQL 17.11 on x86_64-pc-linux-musl di db.contoh.id:5432/elearning (schema "public", pengguna "elearning_app")');
    expect(lines[1]).toBe("TLS      : ya");
    expect(lines[2]).toBe("Schema   : berisi 2 objek tanpa riwayat migrasi");
    expect(lines[3]).toMatch(/^GAGAL: schema "public" sudah berisi 2 tabel/);
    expect(lines[4]).toMatch(/^ {2}→ Pakai database KHUSUS/);
  });

  it("TLS tak diketahui dan peringatan tampil sebagai PERHATIAN", () => {
    const p = probe({ tls: null, migrationsTable: true, appliedMigrations: [...LOCAL, "x"], canCreate: false });
    const lines = formatReport(TARGET, p, assessProbe(p, TARGET, LOCAL));

    expect(lines[1]).toBe("TLS      : tidak diketahui");
    expect(lines.filter((l) => l.startsWith("PERHATIAN:"))).toHaveLength(2);
  });
});

describe("localMigrationNames", () => {
  it("hanya direktori, terurut (berkas seperti migration_lock.toml diabaikan)", () => {
    const entries = [
      { name: "20260929053000_emails_lowercase", isDirectory: () => true },
      { name: "migration_lock.toml", isDirectory: () => false },
      { name: "20260927095024_init", isDirectory: () => true },
    ];

    expect(localMigrationNames(entries)).toEqual(["20260927095024_init", "20260929053000_emails_lowercase"]);
  });
});

describe("redactPassword", () => {
  const RAW = "postgresql://elearning_app:Pa%40ss%3Aw%2Frd%231%25@db.contoh.id:5432/elearning?schema=x";

  it("kata sandi di dalam URL yang tercetak dalam teks galat disamarkan", () => {
    const out = redactPassword(`gagal terhubung ke postgresql://elearning_app:Pa%40ss%3Aw%2Frd%231%25@db.contoh.id:5432/elearning`, RAW);

    expect(out).toBe("gagal terhubung ke postgresql://elearning_app:***@db.contoh.id:5432/elearning");
  });

  it("kata sandi (bentuk ter-encode maupun asli) yang muncul sendirian di teks disamarkan", () => {
    const out = redactPassword("password authentication failed; dicoba: Pa@ss:w/rd#1% / Pa%40ss%3Aw%2Frd%231%25", RAW);

    expect(out).not.toContain("Pa@ss");
    expect(out).not.toContain("Pa%40ss");
    expect(out).toContain("***");
  });

  it("teks tanpa rahasia tidak berubah; kata sandi sangat pendek (< 3) tidak dipakai sebagai pola", () => {
    expect(redactPassword("Can't reach database server at `db.contoh.id:5432`", RAW)).toBe("Can't reach database server at `db.contoh.id:5432`");
    expect(redactPassword("ab ab ab", "postgresql://u:ab@h/d")).toBe("ab ab ab");
  });

  it("tanpa URL asli: hanya pola postgresql://user:***@", () => {
    expect(redactPassword("x postgres://u:rahasia@h/d y", undefined)).toBe("x postgres://u:***@h/d y");
  });
});

describe("connectionFailureHint (galat Prisma yang sungguh diamati)", () => {
  /** Bentuk NYATA (Prisma 6, image deploy): PrismaClientInitializationError TANPA properti code/errorCode dan TANPA kode di teks. */
  const initError = (message: string) => Object.assign(new Error(`Invalid \`prisma.$queryRawUnsafe()\` invocation:\n${message}`), { name: "PrismaClientInitializationError" });

  it("kata sandi/pengguna salah (kalimat asli Prisma, tanpa kode): petunjuk kata sandi dan encode", () => {
    const hint = connectionFailureHint(initError("Authentication failed against database server, the provided database credentials for `elearning_app` are not valid."));

    expect(hint).toContain("kata sandi ditolak");
    expect(hint).toContain("%40");
    expect(hint).toContain("%24");
  });

  it("server tak terjangkau dengan host localhost: localhost di container = container itu sendiri, tunjuk host.docker.internal", () => {
    const hint = connectionFailureHint(initError("Can't reach database server at `localhost:5433`\n\nPlease make sure your database server is running at `localhost:5433`."), {
      ...TARGET,
      host: "localhost",
    });

    expect(hint).toContain("BUKAN mesin server");
    expect(hint).toContain("host.docker.internal");
    expect(hint).toContain("pg_hba.conf");
  });

  it("server tak terjangkau dengan host biasa: firewall, listen_addresses, pg_hba.conf; tanpa keterangan localhost", () => {
    const hint = connectionFailureHint(initError("Can't reach database server at `db.contoh.id:5432`"), TARGET);

    expect(hint).toContain("listen_addresses");
    expect(hint).not.toContain("BUKAN mesin server");
  });

  it("database tidak ada (kalimat asli Prisma dengan tanda kutip terbalik, dan bentuk FATAL Postgres dengan kutip ganda)", () => {
    expect(connectionFailureHint(initError("Database `tidak_ada` does not exist"))).toContain("tidak ada di server");
    expect(connectionFailureHint(new Error('FATAL: database "tidak_ada" does not exist'))).toContain("tidak ada di server");
  });

  it.each([
    ["The database server at `db:5432` was reached but timed out.", "tidak menjawab tepat waktu"],
    ["User was denied access on the database `elearning`", "sslmode=require"],
    ["Error opening a TLS connection: self-signed certificate", "TLS"],
    ["The provided database string is invalid. invalid port number in database URL.", ENCODE_HINT],
  ])("kalimat asli Prisma '%s' -> penjelasan yang tepat", (message, dikandung) => {
    expect(connectionFailureHint(initError(message))).toContain(dikandung);
  });

  it("kode eksplisit (properti errorCode atau code, atau di teks) diutamakan atas kalimat", () => {
    expect(connectionFailureHint(Object.assign(new Error("apa saja"), { errorCode: "P1003" }))).toContain("tidak ada di server");
    expect(connectionFailureHint(Object.assign(new Error("apa saja"), { code: "P1002" }))).toContain("tidak menjawab tepat waktu");
    expect(connectionFailureHint(new Error("Error: P1001: sesuatu"))).toContain("Server tidak terjangkau");
    expect(connectionFailureHint(Object.assign(new Error("Can't reach database server"), { code: "P1000" }))).toContain("kata sandi ditolak");
  });

  it("properti code yang bukan kode Prisma (mis. ECONNREFUSED) diabaikan", () => {
    expect(connectionFailureHint(Object.assign(new Error("Can't reach database server at `h:1`"), { code: "ECONNREFUSED" }))).toContain("Server tidak terjangkau");
  });

  it("permission denied dikenali dari teks", () => {
    expect(connectionFailureHint(new Error("ERROR: permission denied for schema public"))).toContain("hak CREATE");
  });

  it("galat lain: pesan umum yang menunjuk dokumentasi; nilai non-Error tidak membuat gagal", () => {
    expect(connectionFailureHint(new Error("sesuatu yang aneh"))).toContain("docs/DEPLOY.md");
    expect(connectionFailureHint("teks mentah")).toContain("docs/DEPLOY.md");
    expect(connectionFailureHint(undefined)).toContain("docs/DEPLOY.md");
    expect(connectionFailureHint(null)).toContain("docs/DEPLOY.md");
  });
});
