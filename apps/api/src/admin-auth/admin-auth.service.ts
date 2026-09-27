import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS_CLIENT } from "../redis/redis.module";
import { hashOpaqueToken } from "../common/opaque-token.util";
import { addDuration } from "../common/duration.util";
import type { Env } from "../config/env.validation";

const LOGIN_FAIL_LIMIT = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;

/** Mirror AuthService tapi untuk AdminUser -- secret JWT, tabel refresh
 * token, dan namespace key Redis SEMUA terpisah dari sisi murid (lihat plan
 * bagian 4 & 6: batas kepercayaan student vs admin harus struktural, bukan
 * cuma route berbeda). Tidak ada invitation/registration di sini -- akun
 * admin dibuat manual/seed, bukan lewat undangan email. */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async login(email: string, password: string) {
    const lockKey = `admin_login_lock:${email}`;
    if (await this.redis.get(lockKey)) {
      throw new ForbiddenException("Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.");
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    const passwordOk = admin !== null && admin.isActive && (await argon2.verify(admin.passwordHash, password));

    // Guard tunggal di `admin` (bukan cuma `passwordOk`) supaya TS bisa
    // menyempitkan `admin` ke non-null di baris-baris berikutnya.
    if (!admin || !passwordOk) {
      await this.recordFailedLogin(email);
      throw new UnauthorizedException("Email atau password salah");
    }

    await this.redis.del(`admin_login_fail:${email}`);
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokenPair(admin.id, admin.role);
  }

  private async recordFailedLogin(email: string): Promise<void> {
    const failKey = `admin_login_fail:${email}`;
    const attempts = await this.redis.incr(failKey);
    if (attempts === 1) await this.redis.expire(failKey, LOGIN_LOCK_SECONDS);
    if (attempts >= LOGIN_FAIL_LIMIT) {
      await this.redis.set(`admin_login_lock:${email}`, "1", "EX", LOGIN_LOCK_SECONDS);
    }
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: this.config.get("JWT_ADMIN_SECRET", { infer: true }) });
    } catch {
      throw new UnauthorizedException("Refresh token tidak valid");
    }

    const tokenHash = hashOpaqueToken(refreshToken);
    const existing = await this.prisma.adminRefreshToken.findUnique({ where: { tokenHash } });
    // Selain lookup by hash, cocokkan juga sub JWT dengan pemilik baris DB --
    // pertahanan berlapis terhadap tokenHash yang entah bagaimana menunjuk ke
    // adminUserId yang salah (seharusnya mustahil, tapi murah untuk dicek).
    if (!existing || existing.adminUserId !== payload.sub) {
      throw new UnauthorizedException("Refresh token tidak dikenali");
    }

    if (existing.revokedAt) {
      await this.prisma.adminRefreshToken.updateMany({
        where: { adminUserId: existing.adminUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token sudah dipakai sebelumnya -- silakan login ulang");
    }

    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: existing.adminUserId } });
    const pair = await this.issueTokenPair(admin.id, admin.role);
    await this.prisma.adminRefreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByToken: hashOpaqueToken(pair.refreshToken) },
    });
    return pair;
  }

  async me(adminUserId: string) {
    return this.prisma.adminUser.findUniqueOrThrow({
      where: { id: adminUserId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, lastLoginAt: true },
    });
  }

  private async issueTokenPair(adminUserId: string, role: string): Promise<{ accessToken: string; refreshToken: string }> {
    const secret = this.config.get("JWT_ADMIN_SECRET", { infer: true });
    const accessToken = await this.jwt.signAsync(
      { sub: adminUserId, role, type: "access" },
      { secret, expiresIn: this.config.get("JWT_ACCESS_TTL", { infer: true }) },
    );
    const refreshTtl = this.config.get("JWT_REFRESH_TTL", { infer: true });
    const refreshToken = await this.jwt.signAsync(
      { sub: adminUserId, jti: randomUUID(), type: "refresh" },
      { secret, expiresIn: refreshTtl },
    );

    await this.prisma.adminRefreshToken.create({
      data: {
        adminUserId,
        tokenHash: hashOpaqueToken(refreshToken),
        expiresAt: addDuration(new Date(), refreshTtl),
      },
    });

    return { accessToken, refreshToken };
  }
}
