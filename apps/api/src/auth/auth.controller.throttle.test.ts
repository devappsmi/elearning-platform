import "reflect-metadata";
import { Module, type INestApplication } from "@nestjs/common";
import { APP_GUARD, APP_PIPE, NestFactory } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseTrustProxy } from "../common/trust-proxy";
import { createValidationPipe } from "../common/validation";
import { FORGOT_IP_LIMIT } from "./auth.const";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/auth.dto";

// `POST /auth/forgot` lewat HTTP NYATA (Express + ThrottlerGuard + ValidationPipe global + controller asli;
// hanya AuthService yang ditiru). Yang dibuktikan: batas per-IP benar-benar memblokir (bukan sekadar
// dekorator yang terpasang), DTO menormalkan email sebelum sampai ke service, dan `TRUST_PROXY`
// menentukan siapa yang dianggap "klien" bagi pembatas (docs/PLAN.md bagian 6f).
//
// vitest (esbuild) tidak menghasilkan metadata tipe yang di runtime sungguhan diisi tsc -- diberikan manual:
Reflect.defineMetadata("design:paramtypes", [AuthService], AuthController);
Reflect.defineMetadata("design:paramtypes", [ForgotPasswordDto], AuthController.prototype, "forgot");

const forgotPassword = vi.fn(async (_email: string) => undefined);

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])], // sama dengan AppModule
  controllers: [AuthController],
  providers: [
    { provide: AuthService, useValue: { forgotPassword } },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
class TestModule {}

let app: INestApplication | undefined;

async function start(trustProxy?: string): Promise<string> {
  forgotPassword.mockClear();
  app = await NestFactory.create(TestModule, { logger: false });
  const proxy = parseTrustProxy(trustProxy);
  if (proxy !== false) app.getHttpAdapter().getInstance().set("trust proxy", proxy); // sama dengan main.ts
  await app.listen(0, "127.0.0.1");
  return await app.getUrl();
}

async function forgot(url: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${url}/auth/forgot`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as { message?: string | string[] } };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("POST /auth/forgot -- batas per-IP", () => {
  it(`${FORGOT_IP_LIMIT} permintaan pertama lolos, berikutnya 429 dan TIDAK sampai ke service`, async () => {
    const url = await start();

    for (let i = 0; i < FORGOT_IP_LIMIT; i++) {
      const ok = await forgot(url, { email: `murid${i}@example.com` });
      expect(ok.status).toBe(200);
      expect(ok.body.message).toBe("Kalau email terdaftar, link reset sudah dikirim.");
    }
    const blocked = await forgot(url, { email: "murid-baru@example.com" });

    expect(blocked.status).toBe(429);
    expect(forgotPassword).toHaveBeenCalledTimes(FORGOT_IP_LIMIT);
  });

  it("batas ini JAUH lebih ketat dari default global (100/menit): tanpa dekorator, ke-31 masih lolos", () => {
    expect(FORGOT_IP_LIMIT).toBeLessThan(100);
  });
});

describe("POST /auth/forgot -- DTO nyata di depan service", () => {
  it("email dinormalkan (huruf kecil, tanpa spasi tepi) sebelum sampai ke service", async () => {
    const url = await start();

    const response = await forgot(url, { email: "  Budi.Santoso@Example.COM " });

    expect(response.status).toBe(200);
    expect(forgotPassword).toHaveBeenCalledWith("budi.santoso@example.com");
  });

  it.each(["bukan-email", "", 123, null])("email tidak valid (%j) -> 400 dan service tidak dipanggil", async (email) => {
    const url = await start();

    const response = await forgot(url, { email });

    expect(response.status).toBe(400);
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it("field tak dikenal ditolak (whitelist global)", async () => {
    const url = await start();

    expect((await forgot(url, { email: "a@example.com", role: "admin" })).status).toBe(400);
  });
});

describe("POST /auth/forgot -- TRUST_PROXY menentukan siapa 'klien' bagi pembatas", () => {
  async function exhaust(url: string, headers: Record<string, string>) {
    for (let i = 0; i < FORGOT_IP_LIMIT; i++) expect((await forgot(url, { email: `a${i}@example.com` }, headers)).status).toBe(200);
    expect((await forgot(url, { email: "lagi@example.com" }, headers)).status).toBe(429);
  }

  it("tanpa TRUST_PROXY (bawaan/dev): X-Forwarded-For DIABAIKAN -- semua klien berbagi satu jatah, dan header palsu tak membantu", async () => {
    const url = await start();

    await exhaust(url, { "x-forwarded-for": "1.1.1.1" });

    // Klien "lain" hanya mengganti header -> tetap kena batas yang sama.
    expect((await forgot(url, { email: "b@example.com" }, { "x-forwarded-for": "2.2.2.2" })).status).toBe(429);
  });

  it("TRUST_PROXY=1: tiap klien di belakang proxy punya jatah sendiri (bukan satu jatah untuk seluruh lembaga)", async () => {
    const url = await start("1");

    await exhaust(url, { "x-forwarded-for": "1.1.1.1" });

    expect((await forgot(url, { email: "b@example.com" }, { "x-forwarded-for": "2.2.2.2" })).status).toBe(200);
  });

  it("TRUST_PROXY=1: klien tidak bisa lolos dengan menambahkan alamat palsu di depan (yang dipercaya hanya entri dari proxy tepercaya)", async () => {
    const url = await start("1");
    await exhaust(url, { "x-forwarded-for": "1.1.1.1" });

    // Klien 1.1.1.1 mengirim daftar dengan entri palsu di depan; proxy menambahkan alamat aslinya di BELAKANG.
    const spoofed = await forgot(url, { email: "c@example.com" }, { "x-forwarded-for": "9.9.9.9, 1.1.1.1" });

    expect(spoofed.status).toBe(429);
  });
});
