import "reflect-metadata";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { IsInt, IsString, Max, Min } from "class-validator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createValidationPipe, VALIDATION_PIPE_OPTIONS } from "./validation";

// Penjaga docs/PLAN.md bagian 6e: API pernah berjalan TANPA ValidationPipe
// sama sekali, sehingga semua dekorator class-validator di DTO cuma hiasan --
// dan tidak ada yang tahu, karena semuanya tampak benar di kode dan OpenAPI.
// Tes di bawah gagal keras kalau pipe itu hilang lagi dari AppModule.

// `ConfigModule.forRoot` di AppModule memvalidasi env SAAT DIIMPOR, dan CI
// tidak punya .env -- jadi env minimal di-stub dulu sebelum import dinamis.
const ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  JWT_STUDENT_SECRET: "s".repeat(32),
  JWT_ADMIN_SECRET: "a".repeat(32),
  MAIL_FROM: "noreply@example.com",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "audio-assets",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
  CORS_ORIGIN_STUDENT: "http://localhost:5173",
  CORS_ORIGIN_ADMIN: "http://localhost:5174",
};

class ProbeDto {
  @IsString()
  label!: string;

  @IsInt()
  @Min(0)
  @Max(10)
  level!: number;
}

async function rejection(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return JSON.stringify((error as BadRequestException).getResponse());
  }
  throw new Error("Validasi seharusnya menolak input ini, tapi lolos");
}

describe("APP_PIPE di AppModule", () => {
  let registered: ValidationPipe;

  beforeAll(async () => {
    for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
    const { AppModule } = await import("../app.module");
    const providers = Reflect.getMetadata("providers", AppModule) as Array<{ provide?: unknown; useFactory?: () => unknown }>;
    const entry = providers.find((p) => p.provide === APP_PIPE);
    expect(entry, "AppModule TIDAK mendaftarkan APP_PIPE -- semua validasi DTO mati (docs/PLAN.md bagian 6e)").toBeDefined();
    registered = entry!.useFactory!() as ValidationPipe;
  }, 60_000);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("yang terdaftar adalah ValidationPipe", () => {
    expect(registered).toBeInstanceOf(ValidationPipe);
  });

  it("menolak nilai yang melanggar dekorator DTO (400)", async () => {
    const meta = { type: "body", metatype: ProbeDto } as const;

    expect(await rejection(registered.transform({ label: "x", level: 99 }, meta))).toContain("level");
    expect(await rejection(registered.transform({ label: 5, level: 1 }, meta))).toContain("label");
    expect(await rejection(registered.transform({ label: "x" }, meta))).toContain("level");
  });

  it("menolak field yang tidak dideklarasikan di DTO -- pertahanan mass assignment", async () => {
    const message = await rejection(registered.transform({ label: "x", level: 1, classId: "kelas-lain" }, { type: "body", metatype: ProbeDto }));

    expect(message).toContain("classId");
  });

  it("payload sah lolos dan menjadi instance DTO", async () => {
    const dto = await registered.transform({ label: "x", level: 3 }, { type: "body", metatype: ProbeDto });

    expect(dto).toBeInstanceOf(ProbeDto);
    expect(dto).toMatchObject({ label: "x", level: 3 });
  });
});

describe("VALIDATION_PIPE_OPTIONS", () => {
  it("whitelist + forbidNonWhitelisted + transform semuanya menyala", () => {
    expect(VALIDATION_PIPE_OPTIONS).toMatchObject({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  });

  it("createValidationPipe memakai opsi itu (bukan konfigurasi lain)", async () => {
    const pipe = createValidationPipe();

    expect(await rejection(pipe.transform({ label: "x", level: 1, extra: true }, { type: "body", metatype: ProbeDto }))).toContain("extra");
  });
});
