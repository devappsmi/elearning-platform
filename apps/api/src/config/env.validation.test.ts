import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

const BASE = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  JWT_STUDENT_SECRET: "student-secret-0123456789",
  JWT_ADMIN_SECRET: "admin-secret-0123456789",
  MAIL_FROM: "noreply@contoh.id",
  S3_ENDPOINT: "http://storage:8333",
  S3_REGION: "us-east-1",
  S3_BUCKET: "audio-assets",
  S3_ACCESS_KEY_ID: "kunci",
  S3_SECRET_ACCESS_KEY: "rahasia",
  CORS_ORIGIN_STUDENT: "https://app.contoh.id",
  CORS_ORIGIN_ADMIN: "https://admin.contoh.id",
};

describe("validateEnv -- S3_PUBLIC_BASE_URL", () => {
  it("tidak diisi -> undefined (API memakai endpoint/bucket seperti dulu)", () => {
    expect(validateEnv(BASE).S3_PUBLIC_BASE_URL).toBeUndefined();
  });

  it("string kosong (baris `S3_PUBLIC_BASE_URL=` di .env/compose) -> undefined, bukan galat 'Invalid url'", () => {
    expect(validateEnv({ ...BASE, S3_PUBLIC_BASE_URL: "" }).S3_PUBLIC_BASE_URL).toBeUndefined();
  });

  it("URL sungguhan diterima apa adanya", () => {
    expect(validateEnv({ ...BASE, S3_PUBLIC_BASE_URL: "https://app.contoh.id/media" }).S3_PUBLIC_BASE_URL).toBe("https://app.contoh.id/media");
  });

  it("bukan URL -> gagal saat boot dengan nama variabelnya (bukan audio rusak belakangan)", () => {
    expect(() => validateEnv({ ...BASE, S3_PUBLIC_BASE_URL: "app.contoh.id/media" })).toThrow(/S3_PUBLIC_BASE_URL/);
  });
});
