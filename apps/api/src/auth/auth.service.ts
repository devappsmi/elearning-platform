import { BadRequestException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS_CLIENT } from "../redis/redis.module";
import { MailService } from "../mail/mail.service";
import { generateOpaqueToken, hashOpaqueToken } from "../common/opaque-token.util";
import { addDuration } from "../common/duration.util";
import type { Env } from "../config/env.validation";

export type InvitationValidationReason = "VALID" | "NOT_FOUND" | "EXPIRED" | "REVOKED" | "ALREADY_ACCEPTED";

const LOGIN_FAIL_LIMIT = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;
const PASSWORD_RESET_TTL_HOURS = 1;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: MailService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async validateInvitation(token: string): Promise<{ reason: InvitationValidationReason; invitationId?: string }> {
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash: hashOpaqueToken(token) } });
    if (!invitation) return { reason: "NOT_FOUND" };
    if (invitation.status === "REVOKED") return { reason: "REVOKED" };
    if (invitation.status === "ACCEPTED") return { reason: "ALREADY_ACCEPTED" };
    if (invitation.status === "EXPIRED" || invitation.expiresAt < new Date()) return { reason: "EXPIRED" };
    return { reason: "VALID", invitationId: invitation.id };
  }

  /** AUTH-02: registrasi via undangan -- classId/email diambil dari
   * Invitation yang TERVALIDASI DI SERVER, sengaja tidak pernah dari body
   * request (mencegah tampering: request yang dimodifikasi tidak bisa
   * mendaftarkan email lain di bawah undangan orang lain). */
  async register(params: { token: string; name: string; password: string }) {
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash: hashOpaqueToken(params.token) } });
    if (!invitation) throw new BadRequestException("Token undangan tidak ditemukan");
    if (invitation.status === "REVOKED") throw new BadRequestException("Undangan sudah dicabut");
    if (invitation.status === "ACCEPTED") throw new BadRequestException("Undangan sudah dipakai");
    if (invitation.status === "EXPIRED" || invitation.expiresAt < new Date()) {
      throw new BadRequestException("Undangan sudah kedaluwarsa");
    }

    const passwordHash = await argon2.hash(params.password, { type: argon2.argon2id });

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          classId: invitation.classId,
          email: invitation.email,
          name: params.name,
          passwordHash,
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      return created;
    });

    return this.issueTokenPair(user.id);
  }

  async login(email: string, password: string) {
    const lockKey = `login_lock:${email}`;
    if (await this.redis.get(lockKey)) {
      throw new ForbiddenException("Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.");
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordOk = user !== null && user.status === "ACTIVE" && (await argon2.verify(user.passwordHash, password));

    // Guard tunggal di `user` (bukan cuma `passwordOk`) supaya TS bisa
    // menyempitkan `user` ke non-null di baris-baris berikutnya.
    if (!user || !passwordOk) {
      await this.recordFailedLogin(email);
      throw new UnauthorizedException("Email atau password salah");
    }

    await this.redis.del(`login_fail:${email}`);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    return this.issueTokenPair(user.id);
  }

  private async recordFailedLogin(email: string): Promise<void> {
    const failKey = `login_fail:${email}`;
    const attempts = await this.redis.incr(failKey);
    if (attempts === 1) await this.redis.expire(failKey, LOGIN_LOCK_SECONDS);
    if (attempts >= LOGIN_FAIL_LIMIT) {
      await this.redis.set(`login_lock:${email}`, "1", "EX", LOGIN_LOCK_SECONDS);
    }
  }

  /** Rotasi + deteksi reuse (lihat plan bagian 4): token refresh yang sudah
   * di-revoke tapi dipakai lagi berarti kemungkinan dicuri -- seluruh
   * chain di-revoke, paksa re-login, bukan cuma menolak request ini saja. */
  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: this.config.get("JWT_STUDENT_SECRET", { infer: true }) });
    } catch {
      throw new UnauthorizedException("Refresh token tidak valid");
    }

    const tokenHash = hashOpaqueToken(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    // Selain lookup by hash, cocokkan juga sub JWT dengan pemilik baris DB --
    // pertahanan berlapis terhadap tokenHash yang entah bagaimana menunjuk ke
    // userId yang salah (seharusnya mustahil, tapi murah untuk dicek).
    if (!existing || existing.userId !== payload.sub) {
      throw new UnauthorizedException("Refresh token tidak dikenali");
    }

    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token sudah dipakai sebelumnya -- silakan login ulang");
    }

    const pair = await this.issueTokenPair(payload.sub);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByToken: hashOpaqueToken(pair.refreshToken) },
    });
    return pair;
  }

  /** Selalu 200 -- tidak membocorkan apakah email terdaftar (no user enumeration). */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const { token, tokenHash } = generateOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    const resetUrl = `${this.config.get("CORS_ORIGIN_STUDENT", { infer: true })}/reset-password/${token}`;
    await this.mail.sendPasswordReset({ to: user.email, resetUrl });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashOpaqueToken(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("Token reset tidak valid atau sudah kedaluwarsa");
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Ganti password -> paksa re-login di semua device (revoke semua refresh token aktif).
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async requestInvitationResend(token: string): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash: hashOpaqueToken(token) } });
    if (!invitation) return; // sama seperti forgotPassword: tidak membocorkan info ke pemanggil

    const admins = await this.prisma.adminUser.findMany({ where: { isActive: true }, select: { email: true } });
    await this.mail.sendInvitationResendRequest({
      adminEmails: admins.map((a) => a.email),
      requesterEmail: invitation.email,
    });
  }

  private async issueTokenPair(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const secret = this.config.get("JWT_STUDENT_SECRET", { infer: true });
    const accessToken = await this.jwt.signAsync(
      { sub: userId, type: "access" },
      { secret, expiresIn: this.config.get("JWT_ACCESS_TTL", { infer: true }) },
    );
    const refreshTtl = this.config.get("JWT_REFRESH_TTL", { infer: true });
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti: randomUUID(), type: "refresh" },
      { secret, expiresIn: refreshTtl },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(refreshToken),
        expiresAt: addDuration(new Date(), refreshTtl),
      },
    });

    return { accessToken, refreshToken };
  }
}
