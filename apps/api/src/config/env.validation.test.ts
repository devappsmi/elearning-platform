import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

// Sengaja TANPA satu pun S3_*: penyimpanan bawaan adalah disk lokal, dan server harus bisa boot tanpa konfigurasi S3.
const BASE = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  JWT_STUDENT_SECRET: "student-secret-0123456789",
  JWT_ADMIN_SECRET: "admin-secret-0123456789",
  MAIL_FROM: "noreply@contoh.id",
  CORS_ORIGIN_STUDENT: "https://app.contoh.id",
  CORS_ORIGIN_ADMIN: "https://admin.contoh.id",
};

const S3 = {
  S3_ENDPOINT: "http://storage:8333",
  S3_REGION: "us-east-1",
  S3_BUCKET: "audio-assets",
  S3_ACCESS_KEY_ID: "kunci",
  S3_SECRET_ACCESS_KEY: "rahasia",
};

describe("validateEnv -- penyimpanan audio", () => {
  it("tanpa S3_* dan tanpa STORAGE_*: boot berhasil dengan driver local", () => {
    const env = validateEnv(BASE);

    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.STORAGE_PUBLIC_BASE_URL).toBeUndefined();
    expect(env.STORAGE_LOCAL_DIR).toBeUndefined();
  });

  it("string kosong (baris `STORAGE_DRIVER=` / `STORAGE_PUBLIC_BASE_URL=` di .env atau compose) = tidak diisi, bukan galat", () => {
    const env = validateEnv({ ...BASE, STORAGE_DRIVER: "", STORAGE_PUBLIC_BASE_URL: "" });

    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.STORAGE_PUBLIC_BASE_URL).toBeUndefined();
  });

  it("alamat publik berupa URL sungguhan diterima apa adanya", () => {
    expect(validateEnv({ ...BASE, STORAGE_PUBLIC_BASE_URL: "https://app.contoh.id/media" }).STORAGE_PUBLIC_BASE_URL).toBe("https://app.contoh.id/media");
  });

  it("alamat publik bukan URL -> gagal saat boot dengan nama variabelnya (bukan audio rusak belakangan)", () => {
    expect(() => validateEnv({ ...BASE, STORAGE_PUBLIC_BASE_URL: "app.contoh.id/media" })).toThrow(/STORAGE_PUBLIC_BASE_URL/);
  });

  it("driver di luar local/s3 -> gagal saat boot", () => {
    expect(() => validateEnv({ ...BASE, STORAGE_DRIVER: "gcs" })).toThrow(/STORAGE_DRIVER/);
  });

  it("driver s3 lengkap -> boot berhasil", () => {
    expect(validateEnv({ ...BASE, STORAGE_DRIVER: "s3", ...S3 }).STORAGE_DRIVER).toBe("s3");
  });

  it("driver s3 tanpa salah satu S3_* -> gagal saat boot dengan nama variabel yang kurang (bukan gagal saat unggah pertama)", () => {
    expect(() => validateEnv({ ...BASE, STORAGE_DRIVER: "s3", ...S3, S3_BUCKET: undefined })).toThrow(/Env tidak valid.*S3_BUCKET/s);
    expect(() => validateEnv({ ...BASE, STORAGE_DRIVER: "s3" })).toThrow(/S3_ENDPOINT/);
  });

  it("variabel S3_* yang tersisa di .env tidak mengganggu driver local", () => {
    expect(validateEnv({ ...BASE, ...S3 }).STORAGE_DRIVER).toBe("local");
  });
});
