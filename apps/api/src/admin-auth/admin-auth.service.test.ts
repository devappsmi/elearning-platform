import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type Redis from "ioredis";
import type { PrismaService } from "../prisma/prisma.service";
import { createFakeRedis } from "../common/fake-redis.testkit";
import { AdminAuthService } from "./admin-auth.service";

// Login admin memakai email BAKU (huruf kecil) sama seperti murid (docs/PLAN.md bagian 6f):
// ejaan lain harus menemukan akun yang sama dan tidak boleh memecah/melewati lockout.

const EMAIL = "admin@example.com";
const PASSWORD = "AdminPass123";

async function setup() {
  const admin = {
    id: "admin-1",
    email: EMAIL,
    isActive: true,
    role: "OWNER",
    passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id, memoryCost: 1024, timeCost: 2 }),
  };
  const prisma = {
    adminUser: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => (where.email === admin.email ? admin : null)),
      update: vi.fn(async () => admin),
    },
    adminRefreshToken: { create: vi.fn(async () => ({})) },
  };
  let signed = 0;
  const jwt = { signAsync: vi.fn(async () => `jwt-${++signed}`) };
  const config = { get: (key: string) => ({ JWT_ADMIN_SECRET: "rahasia-admin", JWT_ACCESS_TTL: "1h", JWT_REFRESH_TTL: "14d" })[key] };
  const redis = createFakeRedis();
  const service = new AdminAuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService<never, true>,
    redis as unknown as Redis,
  );
  return { service, prisma, redis };
}

describe("AdminAuthService.login -- email dinormalkan", () => {
  it.each(["Admin@Example.com", "ADMIN@EXAMPLE.COM", "  admin@example.com "])("login dengan ejaan %j menemukan akun yang sama", async (typed) => {
    const { service, prisma } = await setup();

    const pair = await service.login(typed, PASSWORD);

    expect(pair.accessToken).toBeTruthy();
    expect(prisma.adminUser.findUnique).toHaveBeenCalledWith({ where: { email: EMAIL } });
  });

  it("lockout memakai email baku: 5 kegagalan dengan ejaan campur mengunci akun yang sama, tanpa kunci terpecah", async () => {
    const { service, redis } = await setup();

    for (const typed of ["Admin@Example.com", "ADMIN@example.com", "admin@example.com", " Admin@EXAMPLE.com ", "admin@EXAMPLE.COM"]) {
      await expect(service.login(typed, "salah-terus")).rejects.toBeInstanceOf(UnauthorizedException);
    }

    await expect(service.login("ADMIN@Example.COM", PASSWORD)).rejects.toBeInstanceOf(ForbiddenException);
    expect([...redis.store.keys()].sort()).toEqual([`admin_login_fail:${EMAIL}`, `admin_login_lock:${EMAIL}`]);
  });

  it("namespace kunci admin tetap terpisah dari murid", async () => {
    const { service, redis } = await setup();
    await expect(service.login(EMAIL, "salah")).rejects.toBeInstanceOf(UnauthorizedException);

    expect([...redis.store.keys()].every((key) => key.startsWith("admin_"))).toBe(true);
  });
});
