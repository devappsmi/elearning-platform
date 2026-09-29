import { z } from "zod";
import { resolveStorageOptions } from "../audio/storage-options";

/** Validated once at boot (see main.ts) -- fails fast with a clear message
 * instead of a random crash the first time a missing env var is read. */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_STUDENT_SECRET: z.string().min(16),
  JWT_ADMIN_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("1h"),
  JWT_REFRESH_TTL: z.string().default("14d"),

  MAIL_FROM: z.string().email(),
  MAIL_PROVIDER_API_KEY: z.string().optional(),

  // Penyimpanan audio (cache TTS). `local` (BAWAAN, tahap uji coba): berkas di disk (STORAGE_LOCAL_DIR) dan disajikan
  // API di /media. `s3`: penyimpanan S3-kompatibel (untuk nanti) -- butuh kelima S3_* di bawah. Aturan bawaan dan
  // pemeriksaan silang ada di audio/audio-storage.ts (`resolveStorageOptions`, dipanggil juga dari validateEnv).
  STORAGE_DRIVER: z.preprocess((value) => (value === "" ? undefined : value), z.enum(["local", "s3"]).default("local")),
  STORAGE_LOCAL_DIR: z.string().optional(),
  // Alamat PUBLIK berkas (yang dibuka browser dan disimpan di AudioAsset.s3Url -- nama kolom warisan). Kosong: driver
  // local = http://localhost:${PORT}/media (pengembangan lokal); driver s3 = ${S3_ENDPOINT}/${S3_BUCKET}. Di belakang
  // reverse proxy isi dengan URL publiknya (mis. https://app.contoh.id/media). Nilainya ikut tersimpan di baris audio:
  // tetapkan dari awal (mengganti belakangan = perbarui s3_url, lihat docs/DEPLOY.md).
  STORAGE_PUBLIC_BASE_URL: z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional()),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_CHAT_MODEL: z.string().default("gpt-5.6-terra"),
  OPENAI_STT_MODEL: z.string().default("gpt-transcribe"),
  OPENAI_TTS_MODEL: z.string().default("gpt-4o-mini-tts"),
  OPENAI_TTS_VOICE_DEFAULT: z.string().default("nova"),
  // Kuota balasan AI tutor per murid per hari (Milestone 11) -- versi lama
  // hardcode 20; sekarang bisa diubah tanpa deploy kode.
  TUTOR_DAILY_QUOTA: z.coerce.number().int().positive().default(20),

  // AZURE_SPEECH_KEY/REGION opsional -- AzureTtsClient (AudioModule, Milestone 8)
  // melempar error yang jelas SAAT DIPANGGIL kalau kosong, bukan gagal di boot;
  // biar server & seed tetap bisa jalan di environment tanpa kredensial TTS
  // (audio jadi placeholder kosong sampai kredensial tersedia).
  AZURE_SPEECH_KEY: z.string().optional(),
  AZURE_SPEECH_REGION: z.string().optional(),
  AZURE_TTS_VOICE_FEMALE: z.string().default("ja-JP-NanamiNeural"),
  AZURE_TTS_VOICE_MALE: z.string().default("ja-JP-KeitaNeural"),

  CORS_ORIGIN_STUDENT: z.string().url(),
  CORS_ORIGIN_ADMIN: z.string().url(),

  // Proxy tepercaya di depan API (lihat common/trust-proxy.ts). Opsional: kosong = tanpa proxy.
  TRUST_PROXY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Env tidak valid, cek .env (lihat .env.example):\n${issues}`);
  }
  // Pemeriksaan silang yang tak bisa diungkapkan per-variabel: driver s3 butuh kelima S3_*.
  try {
    resolveStorageOptions(parsed.data);
  } catch (error) {
    throw new Error(`Env tidak valid, cek .env (lihat .env.example):\n  - ${(error as Error).message}`);
  }
  return parsed.data;
}
