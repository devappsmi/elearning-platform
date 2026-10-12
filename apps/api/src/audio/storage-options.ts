import type { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.validation";

/** Opsi penyimpanan audio yang diturunkan dari env -- murni (tanpa I/O dan tanpa mengimpor driver mana pun), supaya
 * validasi env saat boot tetap ringan. Pabrik driver-nya ada di audio-storage.ts. */

/** Nilai mentah yang menentukan penyimpanan -- cukup subset env, sehingga bisa diisi dari ConfigService (API)
 * maupun `process.env` (seed.ts) dengan aturan bawaan yang SAMA. */
export interface StorageEnv {
  STORAGE_DRIVER?: string;
  STORAGE_LOCAL_DIR?: string;
  STORAGE_PUBLIC_BASE_URL?: string;
  PORT?: number | string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
}

export type StorageOptions =
  | { driver: "local"; localDir: string; publicBaseUrl: string }
  | { driver: "s3"; endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl?: string };

const S3_REQUIRED = ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;

/** Menerjemahkan env menjadi opsi penyimpanan, dengan galat yang jelas untuk konfigurasi yang salah.
 *
 * - `local` (BAWAAN): berkas ditulis ke `STORAGE_LOCAL_DIR` dan disajikan API di `/media`. Tanpa layanan tambahan;
 *   dipilih untuk tahap uji coba. `STORAGE_PUBLIC_BASE_URL` = alamat yang dibuka browser (tanpa garis miring akhir);
 *   kosong = `http://localhost:${PORT}/media`, benar untuk pengembangan lokal.
 * - `s3`: penyimpanan S3-kompatibel (untuk nanti); butuh kelima variabel S3_*. */
export function resolveStorageOptions(env: StorageEnv): StorageOptions {
  const driver = env.STORAGE_DRIVER?.trim() || "local";

  if (driver === "local") {
    const localDir = env.STORAGE_LOCAL_DIR?.trim() || "./storage";
    const publicBaseUrl = (env.STORAGE_PUBLIC_BASE_URL?.trim() || `http://localhost:${env.PORT || 3001}/media`).replace(/\/+$/, "");
    return { driver, localDir, publicBaseUrl };
  }

  if (driver === "s3") {
    const missing = S3_REQUIRED.filter((name) => !env[name]?.trim());
    if (missing.length > 0) throw new Error(`STORAGE_DRIVER=s3 butuh ${missing.join(", ")} (lihat .env.example)`);
    return {
      driver,
      endpoint: env.S3_ENDPOINT!.trim(),
      region: env.S3_REGION!.trim(),
      bucket: env.S3_BUCKET!.trim(),
      accessKeyId: env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!.trim(),
      publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL?.trim() || undefined,
    };
  }

  throw new Error(`STORAGE_DRIVER="${driver}" tidak dikenal (pilihan: local, s3)`);
}

/** Membaca nilai penyimpanan dari ConfigService (env yang sudah divalidasi) -- dipakai AudioModule dan main.ts. */
export function storageEnvFromConfig(config: ConfigService<Env, true>): StorageEnv {
  return {
    STORAGE_DRIVER: config.get("STORAGE_DRIVER", { infer: true }),
    STORAGE_LOCAL_DIR: config.get("STORAGE_LOCAL_DIR", { infer: true }),
    STORAGE_PUBLIC_BASE_URL: config.get("STORAGE_PUBLIC_BASE_URL", { infer: true }),
    PORT: config.get("PORT", { infer: true }),
    S3_ENDPOINT: config.get("S3_ENDPOINT", { infer: true }),
    S3_REGION: config.get("S3_REGION", { infer: true }),
    S3_BUCKET: config.get("S3_BUCKET", { infer: true }),
    S3_ACCESS_KEY_ID: config.get("S3_ACCESS_KEY_ID", { infer: true }),
    S3_SECRET_ACCESS_KEY: config.get("S3_SECRET_ACCESS_KEY", { infer: true }),
  };
}
