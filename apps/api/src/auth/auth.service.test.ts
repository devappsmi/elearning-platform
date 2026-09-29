import { describe, expect, it, vi } from "vitest";
import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type Redis from "ioredis";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { hashOpaqueToken } from "../common/opaque-token.util";
import { AuthService } from "./auth.service";

// Halaman /invite/:token (PRD S1) bergantung pada `validateInvitation`: tiap
// status token harus dipetakan ke `reason` yang benar, dan detail undangan
// (nama/email/kelas/lembaga) HANYA boleh keluar saat VALID.

const DAY = 86_400_000;

interface InvitationRow {
  id: string;
  name: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expiresAt: Date;
  class: { name: string };
}

const row = (over: Partial<InvitationRow> = {}): InvitationRow => ({
  id: "inv-1",
  name: "Budi Santoso",
  email: "budi@example.com",
  status: "PENDING",
  expiresAt: new Date(Date.now() + 3 * DAY),
  class: { name: "Kelas Hiragana Pagi" },
  ...over,
});

function setup(invitation: InvitationRow | null, institution: { name: string } | null = { name: "Lembaga Kursus Contoh" }) {
  const findUnique = vi.fn().mockResolvedValue(invitation);
  const findFirst = vi.fn().mockResolvedValue(institution);
  const prisma = { invitation: { findUnique }, institution: { findFirst } } as unknown as PrismaService;
  const service = new AuthService(prisma, {} as JwtService, {} as ConfigService<never, true>, {} as MailService, {} as Redis);
  return { service, findUnique, findFirst };
}

describe("AuthService.validateInvitation", () => {
  it("VALID: mengembalikan detail undangan untuk form registrasi", async () => {
    const { service } = setup(row());

    expect(await service.validateInvitation("token-mentah")).toEqual({
      reason: "VALID",
      invitationId: "inv-1",
      name: "Budi Santoso",
      email: "budi@example.com",
      className: "Kelas Hiragana Pagi",
      institutionName: "Lembaga Kursus Contoh",
    });
  });

  it("VALID tanpa baris Institution -> institutionName null (bukan error)", async () => {
    const { service } = setup(row(), null);

    expect(await service.validateInvitation("t")).toMatchObject({ reason: "VALID", institutionName: null });
  });

  it("mencari undangan lewat HASH token, tidak pernah token mentah", async () => {
    const { service, findUnique } = setup(row());

    await service.validateInvitation("token-mentah");

    expect(findUnique.mock.calls[0]![0].where).toEqual({ tokenHash: hashOpaqueToken("token-mentah") });
    expect(JSON.stringify(findUnique.mock.calls[0]![0])).not.toContain("token-mentah");
  });

  it.each([
    ["token tidak dikenal", null, "NOT_FOUND"],
    ["undangan dicabut", row({ status: "REVOKED" }), "REVOKED"],
    ["undangan sudah dipakai", row({ status: "ACCEPTED" }), "ALREADY_ACCEPTED"],
    ["status EXPIRED", row({ status: "EXPIRED" }), "EXPIRED"],
    ["PENDING tapi sudah lewat masa berlaku", row({ expiresAt: new Date(Date.now() - 1000) }), "EXPIRED"],
  ] as const)("%s -> %s, TANPA detail apa pun", async (_label, invitation, reason) => {
    const { service, findFirst } = setup(invitation);

    const result = await service.validateInvitation("t");

    expect(result).toEqual({ reason });
    expect(findFirst).not.toHaveBeenCalled(); // tidak ada query lembaga untuk token yang tak berlaku
  });

  it("REVOKED lebih diutamakan daripada EXPIRED (undangan yang dicabut tetap 'dicabut' walau sudah lewat waktu)", async () => {
    const { service } = setup(row({ status: "REVOKED", expiresAt: new Date(Date.now() - DAY) }));

    expect(await service.validateInvitation("t")).toEqual({ reason: "REVOKED" });
  });

  it("hanya memilih kolom yang perlu -- tokenHash tidak pernah dibaca", async () => {
    const { service, findUnique } = setup(row());

    await service.validateInvitation("t");

    const select = findUnique.mock.calls[0]![0].select as Record<string, unknown>;
    expect(Object.keys(select).sort()).toEqual(["class", "email", "expiresAt", "id", "name", "status"]);
  });
});


// Reset password (AUTH-03) + kunci login (5x gagal -> 15 menit). Murid yang lupa password
// biasanya sudah terkunci; reset yang berhasil HARUS langsung memungkinkan masuk lagi.

/** Redis tiruan di memori: hanya perintah yang dipakai alur login/reset. */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: vi.fn(async () => 1),
    del: vi.fn(async (...keys: string[]) => keys.filter((key) => store.delete(key)).length),
  };
}

interface UserRow {
  id: string;
  email: string;
  status: "ACTIVE";
  passwordHash: string;
}

interface ResetRow {
  id: string;
  userId: string;
  usedAt: Date | null;
  expiresAt: Date;
}

const EMAIL = "budi@example.com";
const OLD_PASSWORD = "PasswordLama1";
const NEW_PASSWORD = "PasswordBaru2";

async function accountSetup(reset: Partial<ResetRow> | null = {}) {
  // Parameter argon2 diperkecil supaya tes cepat; `verify` membaca parameter dari hash-nya.
  const user: UserRow = {
    id: "user-1",
    email: EMAIL,
    status: "ACTIVE",
    passwordHash: await argon2.hash(OLD_PASSWORD, { type: argon2.argon2id, memoryCost: 1024, timeCost: 2 }),
  };
  const resetRecord: ResetRow | null =
    reset === null ? null : { id: "reset-1", userId: user.id, usedAt: null, expiresAt: new Date(Date.now() + 3_600_000), ...reset };

  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => (where.email === user.email ? user : null)),
      update: vi.fn(async ({ data }: { data: Partial<UserRow> }) => Object.assign(user, data)),
    },
    passwordResetToken: {
      findUnique: vi.fn(async () => resetRecord),
      update: vi.fn(async ({ data }: { data: Partial<ResetRow> }) => Object.assign(resetRecord ?? {}, data)),
    },
    refreshToken: {
      updateMany: vi.fn(async () => ({ count: 2 })),
      create: vi.fn(async () => ({})),
    },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  let signed = 0;
  const jwt = { signAsync: vi.fn(async () => `jwt-${++signed}`) };
  const config = {
    get: (key: string) => ({ JWT_STUDENT_SECRET: "rahasia", JWT_ACCESS_TTL: "1h", JWT_REFRESH_TTL: "14d" })[key],
  };
  const redis = fakeRedis();
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService<never, true>,
    {} as MailService,
    redis as unknown as Redis,
  );
  return { service, user, resetRecord, prisma, redis };
}

async function lockAccount(service: AuthService) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await expect(service.login(EMAIL, "salah-terus")).rejects.toBeInstanceOf(UnauthorizedException);
  }
}

describe("AuthService.resetPassword", () => {
  it("mengganti password (argon2id), menandai token terpakai, dan mencabut semua refresh token aktif", async () => {
    const { service, user, prisma } = await accountSetup();

    await service.resetPassword("token-reset", NEW_PASSWORD);

    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(user.passwordHash, NEW_PASSWORD)).toBe(true);
    expect(await argon2.verify(user.passwordHash, OLD_PASSWORD)).toBe(false);
    expect(prisma.passwordResetToken.update.mock.calls[0]![0].data.usedAt).toBeInstanceOf(Date);
    expect(prisma.refreshToken.updateMany.mock.calls[0]![0].where).toEqual({ userId: "user-1", revokedAt: null });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1); // ketiganya atomik
  });

  it("mencari token lewat HASH-nya, tidak pernah token mentah", async () => {
    const { service, prisma } = await accountSetup();

    await service.resetPassword("token-mentah", NEW_PASSWORD);

    expect(prisma.passwordResetToken.findUnique.mock.calls[0]![0]).toEqual({ where: { tokenHash: hashOpaqueToken("token-mentah") } });
  });

  it("murid yang TERKUNCI bisa langsung masuk dengan password baru setelah reset", async () => {
    const { service } = await accountSetup();
    await lockAccount(service);
    // Terkunci: password yang benar pun ditolak.
    await expect(service.login(EMAIL, OLD_PASSWORD)).rejects.toBeInstanceOf(ForbiddenException);

    await service.resetPassword("token-reset", NEW_PASSWORD);

    const pair = await service.login(EMAIL, NEW_PASSWORD);
    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();
  });

  it("mencabut kunci dan hitungan gagal HANYA milik email akun itu", async () => {
    const { service, redis } = await accountSetup();
    await lockAccount(service);
    redis.store.set("login_lock:orang-lain@example.com", "1");
    expect(redis.store.has(`login_lock:${EMAIL}`)).toBe(true);
    expect(redis.store.has(`login_fail:${EMAIL}`)).toBe(true);

    await service.resetPassword("token-reset", NEW_PASSWORD);

    expect(redis.del).toHaveBeenCalledWith(`login_lock:${EMAIL}`, `login_fail:${EMAIL}`);
    expect(redis.store.has(`login_lock:${EMAIL}`)).toBe(false);
    expect(redis.store.has(`login_fail:${EMAIL}`)).toBe(false);
    expect(redis.store.has("login_lock:orang-lain@example.com")).toBe(true);
  });

  it.each([
    ["token tidak dikenal", null],
    ["token sudah dipakai", { usedAt: new Date() }],
    ["token kedaluwarsa", { expiresAt: new Date(Date.now() - 1000) }],
  ] as const)("%s -> 400 tanpa mengubah apa pun (password, token, sesi, kunci login)", async (_label, reset) => {
    const { service, user, prisma, redis } = await accountSetup(reset);
    await lockAccount(service);
    const hashBefore = user.passwordHash;

    const attempt = service.resetPassword("token-reset", NEW_PASSWORD);

    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(attempt).rejects.toThrow("Token reset tidak valid atau sudah kedaluwarsa");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(user.passwordHash).toBe(hashBefore);
    expect(redis.del).not.toHaveBeenCalled();
    expect(redis.store.has(`login_lock:${EMAIL}`)).toBe(true); // kunci tidak bisa dicabut tanpa token yang sah
  });

  it("kalau transaksi DB gagal, password tetap lama dan kunci login TIDAK dicabut", async () => {
    const { service, prisma, redis } = await accountSetup();
    await lockAccount(service);
    prisma.$transaction.mockRejectedValueOnce(new Error("koneksi putus"));

    await expect(service.resetPassword("token-reset", NEW_PASSWORD)).rejects.toThrow("koneksi putus");

    expect(redis.del).not.toHaveBeenCalled();
    expect(redis.store.has(`login_lock:${EMAIL}`)).toBe(true);
  });
});
