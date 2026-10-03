import { createHash } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.validation";

/** Opsi penyedia TTS audio pelajaran yang diturunkan dari env -- murni (tanpa I/O dan tanpa mengimpor SDK penyedia
 * mana pun), supaya validasi env saat boot tetap ringan (pola sama dengan storage-options.ts). Pabrik kliennya ada di
 * tts-factory.ts. */

export const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
export const DEFAULT_OPENAI_LESSON_VOICE_FEMALE = "nova";
export const DEFAULT_OPENAI_LESSON_VOICE_MALE = "onyx";
export const DEFAULT_AZURE_VOICE_FEMALE = "ja-JP-NanamiNeural";
export const DEFAULT_AZURE_VOICE_MALE = "ja-JP-KeitaNeural";

/** Arahan gaya bicara untuk model `gpt-*-tts` (diabaikan model `tts-1*`). Tujuannya dua: teks pendek/tunggal seperti
 * "あ" dibaca sebagai bahasa Jepang (bukan ditebak sebagai bahasa Inggris), dan tempo cukup pelan untuk pemula. Bisa
 * diganti lewat OPENAI_LESSON_TTS_INSTRUCTIONS; perubahan baru berlaku untuk audio yang DIBUAT sesudahnya. */
export const DEFAULT_OPENAI_LESSON_INSTRUCTIONS =
  "Speak natural, clear standard Japanese (Tokyo accent) for a beginner learner: a slow, steady pace, every kana " +
  "pronounced distinctly. Read the text exactly as written; do not add, translate or explain anything.";

/** Nilai mentah yang menentukan penyedia -- cukup subset env, sehingga bisa diisi dari ConfigService (API) maupun
 * `process.env` (seed.ts, tts-sample.ts) dengan aturan bawaan yang SAMA. */
export interface TtsEnv {
  TTS_PROVIDER?: string;
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  AZURE_TTS_VOICE_FEMALE?: string;
  AZURE_TTS_VOICE_MALE?: string;
  OPENAI_API_KEY?: string;
  OPENAI_TTS_MODEL?: string;
  OPENAI_LESSON_TTS_VOICE_FEMALE?: string;
  OPENAI_LESSON_TTS_VOICE_MALE?: string;
  OPENAI_LESSON_TTS_INSTRUCTIONS?: string;
}

export type TtsOptions =
  | { provider: "azure"; speechKey?: string; speechRegion?: string; voiceFemale: string; voiceMale: string }
  | { provider: "openai"; apiKey?: string; model: string; voiceFemale: string; voiceMale: string; instructions: string }
  /** `disabled` = sengaja dimatikan (TTS_PROVIDER=none); `unconfigured` = mode auto tidak menemukan kredensial. */
  | { provider: "none"; reason: "disabled" | "unconfigured" };

export const TTS_PROVIDER_CHOICES = ["auto", "azure", "openai", "none"] as const;

/** Menerjemahkan env menjadi opsi penyedia, dengan galat yang jelas untuk nama yang salah.
 *
 * `TTS_PROVIDER`:
 * - `auto` (BAWAAN): Azure bila AZURE_SPEECH_KEY dan AZURE_SPEECH_REGION terisi (rekomendasi plan: satu vendor dengan
 *   Pronunciation Assessment Fase 2); kalau tidak, OpenAI bila OPENAI_API_KEY terisi (kunci yang sama dengan AI tutor);
 *   kalau tidak ada satu pun, `none` -- audio pelajaran kosong, aplikasi tetap jalan.
 * - `azure` / `openai`: paksa penyedia itu. Kredensial yang kosong TIDAK menggagalkan boot: galat yang jelas baru
 *   muncul saat sintesis dipanggil (seed melewati pembuatan audio dengan peringatan).
 * - `none`: matikan pembuatan audio pelajaran. */
export function resolveTtsOptions(env: TtsEnv): TtsOptions {
  const choice = env.TTS_PROVIDER?.trim().toLowerCase() || "auto";

  switch (choice) {
    case "none":
      return { provider: "none", reason: "disabled" };
    case "azure":
      return azureOptions(env);
    case "openai":
      return openAiOptions(env);
    case "auto":
      if (has(env.AZURE_SPEECH_KEY) && has(env.AZURE_SPEECH_REGION)) return azureOptions(env);
      if (has(env.OPENAI_API_KEY)) return openAiOptions(env);
      return { provider: "none", reason: "unconfigured" };
    default:
      throw new Error(`TTS_PROVIDER="${choice}" tidak dikenal (pilihan: ${TTS_PROVIDER_CHOICES.join(", ")})`);
  }
}

function has(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function azureOptions(env: TtsEnv): TtsOptions {
  return {
    provider: "azure",
    speechKey: env.AZURE_SPEECH_KEY?.trim() || undefined,
    speechRegion: env.AZURE_SPEECH_REGION?.trim() || undefined,
    voiceFemale: env.AZURE_TTS_VOICE_FEMALE?.trim() || DEFAULT_AZURE_VOICE_FEMALE,
    voiceMale: env.AZURE_TTS_VOICE_MALE?.trim() || DEFAULT_AZURE_VOICE_MALE,
  };
}

function openAiOptions(env: TtsEnv): TtsOptions {
  return {
    provider: "openai",
    apiKey: env.OPENAI_API_KEY?.trim() || undefined,
    model: env.OPENAI_TTS_MODEL?.trim() || DEFAULT_OPENAI_TTS_MODEL,
    voiceFemale: env.OPENAI_LESSON_TTS_VOICE_FEMALE?.trim() || DEFAULT_OPENAI_LESSON_VOICE_FEMALE,
    voiceMale: env.OPENAI_LESSON_TTS_VOICE_MALE?.trim() || DEFAULT_OPENAI_LESSON_VOICE_MALE,
    instructions: env.OPENAI_LESSON_TTS_INSTRUCTIONS?.trim() || DEFAULT_OPENAI_LESSON_INSTRUCTIONS,
  };
}

/** Ringkasan satu baris untuk log seed/CLI. TIDAK memuat kunci atau instruksi. */
export function describeTtsOptions(options: TtsOptions): string {
  switch (options.provider) {
    case "azure":
      return `azure (region ${options.speechRegion ?? "-"}; suara perempuan=${options.voiceFemale}, laki-laki=${options.voiceMale})`;
    case "openai":
      return `openai (model ${options.model}; suara perempuan=${options.voiceFemale}, laki-laki=${options.voiceMale})`;
    case "none":
      return options.reason === "disabled" ? "none (dimatikan lewat TTS_PROVIDER=none)" : "none (tidak ada kredensial TTS yang terisi)";
  }
}

/** Kenapa penyedia terpilih belum bisa dipakai (untuk pesan seed) -- null bila kredensialnya lengkap. Harus selaras dengan
 * `TtsClient.configured` milik klien yang dibuat dari opsi yang sama (dijaga tts-factory.test.ts). */
export function ttsUnavailableReason(options: TtsOptions): string | null {
  switch (options.provider) {
    case "none":
      return options.reason === "disabled" ? "TTS_PROVIDER=none (pembuatan audio pelajaran dimatikan)" : "tidak ada kredensial TTS yang terisi";
    case "openai":
      return options.apiKey ? null : "TTS_PROVIDER=openai tetapi OPENAI_API_KEY kosong";
    case "azure":
      return options.speechKey && options.speechRegion ? null : "TTS_PROVIDER=azure tetapi AZURE_SPEECH_KEY/AZURE_SPEECH_REGION belum lengkap";
  }
}

/** Sidik pendek dari setelan yang mengubah BUNYI audio (penyedia, model/region, suara, instruksi) -- tanpa kunci atau
 * rahasia lain. Dipakai untuk menamai berkas contoh suara: ganti suara = nama berkas baru, jadi browser tidak
 * menyajikan contoh lama dari cache-nya. */
export function ttsFingerprint(options: TtsOptions): string {
  const basis =
    options.provider === "azure"
      ? [options.provider, options.speechRegion, options.voiceFemale, options.voiceMale]
      : options.provider === "openai"
        ? [options.provider, options.model, options.voiceFemale, options.voiceMale, options.instructions]
        : [options.provider];
  return createHash("sha256").update(JSON.stringify(basis)).digest("hex").slice(0, 8);
}

/** Membaca nilai TTS dari ConfigService (env yang sudah divalidasi) -- dipakai AudioModule. */
export function ttsEnvFromConfig(config: ConfigService<Env, true>): TtsEnv {
  return {
    TTS_PROVIDER: config.get("TTS_PROVIDER", { infer: true }),
    AZURE_SPEECH_KEY: config.get("AZURE_SPEECH_KEY", { infer: true }),
    AZURE_SPEECH_REGION: config.get("AZURE_SPEECH_REGION", { infer: true }),
    AZURE_TTS_VOICE_FEMALE: config.get("AZURE_TTS_VOICE_FEMALE", { infer: true }),
    AZURE_TTS_VOICE_MALE: config.get("AZURE_TTS_VOICE_MALE", { infer: true }),
    OPENAI_API_KEY: config.get("OPENAI_API_KEY", { infer: true }),
    OPENAI_TTS_MODEL: config.get("OPENAI_TTS_MODEL", { infer: true }),
    OPENAI_LESSON_TTS_VOICE_FEMALE: config.get("OPENAI_LESSON_TTS_VOICE_FEMALE", { infer: true }),
    OPENAI_LESSON_TTS_VOICE_MALE: config.get("OPENAI_LESSON_TTS_VOICE_MALE", { infer: true }),
    OPENAI_LESSON_TTS_INSTRUCTIONS: config.get("OPENAI_LESSON_TTS_INSTRUCTIONS", { infer: true }),
  };
}
