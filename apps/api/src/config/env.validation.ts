import { z } from "zod";

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

  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),

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
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Env tidak valid, cek .env (lihat .env.example):\n${issues}`);
  }
  return parsed.data;
}
