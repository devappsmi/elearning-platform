import * as fs from "node:fs";
import * as path from "node:path";

/** Membaca berkas `qa/.env` (bila ada) tanpa pustaka tambahan. Variabel yang sudah diset di terminal menang atas berkas. */
function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv(path.resolve(__dirname, "../../.env"));

const trimSlash = (value: string): string => value.replace(/\/+$/, "");
const read = (name: string, fallback = ""): string => (process.env[name] ?? fallback).trim();

export interface Credentials {
  email: string;
  password: string;
}

export const cfg = {
  /** Alamat aplikasi murid, aplikasi admin, dan API (tanpa garis miring di akhir). */
  studentUrl: trimSlash(read("QA_STUDENT_URL", "http://localhost:5173")),
  adminUrl: trimSlash(read("QA_ADMIN_URL", "http://localhost:5174")),
  apiUrl: trimSlash(read("QA_API_URL", "http://localhost:3001")),

  student: { email: read("QA_STUDENT_EMAIL"), password: read("QA_STUDENT_PASSWORD") } satisfies Credentials,
  /** Murid kedua: dipakai uji admin yang mengubah akun (pindah kelas, nonaktifkan). Opsional. */
  student2: { email: read("QA_STUDENT2_EMAIL"), password: read("QA_STUDENT2_PASSWORD") } satisfies Credentials,
  /** Akun KHUSUS uji penguncian. Setelah uji ini akun terkunci 15 menit, jadi jangan dipakai untuk hal lain. */
  lockout: { email: read("QA_LOCKOUT_EMAIL"), password: read("QA_LOCKOUT_PASSWORD") } satisfies Credentials,
  admin: { email: read("QA_ADMIN_EMAIL"), password: read("QA_ADMIN_PASSWORD") } satisfies Credentials,

  /** Pelajaran yang dimainkan uji belajar. `l1` = pelajaran pertama Hiragana, selalu terbuka. */
  lessonId: read("QA_LESSON_ID", "l1"),
  /** Uji AI: `auto` (bawaan, dilewati bila AI belum diaktifkan), `off` (lewati semua), `on` (gagal bila AI belum aktif). */
  ai: read("QA_AI", "auto") as "auto" | "off" | "on",
  /** Uji AI yang merekam suara palsu dari Chromium. Hanya masuk akal terhadap AI tiruan atau untuk mengecek alurnya. */
  aiVoice: read("QA_AI_SUARA") === "1",
  /** Nama pengguna uji yang dibuat uji admin diawali penanda ini, supaya mudah dicari dan dibersihkan. */
  prefix: read("QA_PREFIX", "QA"),
  retries: Number(read("QA_RETRIES", "0")) || 0,
  headed: read("QA_TAMPILKAN_BROWSER") === "1",
  slowMo: Number(read("QA_SLOW_MO", "0")) || 0,
};

export function missing(name: string): string {
  return `${name} belum diisi. Salin qa/.env.example menjadi qa/.env lalu isi nilainya.`;
}
