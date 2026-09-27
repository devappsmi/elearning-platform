import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { BadgeService, StreakService, defaultStreakState, type BadgeContext, type StreakState } from "@elearning/domain";
import type { XpSource } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS_CLIENT } from "../redis/redis.module";
import { weekKey } from "./week.util";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  xp: number;
  rank: number;
}

/** GAM-01/02/03/04/05: XP ledger + streak + badge + leaderboard mingguan.
 * Satu-satunya jalur penulisan XpEvent -- lihat "Keputusan Lintas-Sektor" di
 * plan (XpEvent selalu positif, append-only; pembelian streak-freeze pakai
 * counter terpisah, bukan XpEvent negatif -- BELUM diimplementasi, lihat
 * catatan di README/PLAN). */
@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private leaderboardKey(classId: string, at: Date): string {
    return `leaderboard:${classId}:${weekKey(at)}`;
  }

  /** Dipanggil oleh LessonsModule (dan nanti ScenariosModule/kuis harian) --
   * satu tempat yang mencatat XpEvent, meng-update leaderboard Redis, streak,
   * dan mengevaluasi badge baru. `amount` sudah final (mis. hasil
   * `XpService.lessonXp(stars)`) -- service ini tidak menghitung besarannya. */
  async awardXp(params: { userId: string; source: XpSource; amount: number; refId?: string }): Promise<void> {
    const now = new Date();
    // Sekalian update lastActiveAt -- sebelumnya field ini CUMA di-update saat
    // login (AuthService.login), jadi salah menggambarkan "terakhir aktif"
    // untuk dashboard admin (ADM-30 "murid aktif minggu ini") begitu murid
    // login sekali lalu belajar berhari-hari tanpa login ulang (JWT access
    // token 1 jam + refresh diam-diam, tidak pernah login ulang lagi).
    const user = await this.prisma.user.update({ where: { id: params.userId }, data: { lastActiveAt: now }, select: { classId: true } });

    await this.prisma.xpEvent.create({
      data: { userId: params.userId, source: params.source, amount: params.amount, refId: params.refId },
    });
    await this.redis.zincrby(this.leaderboardKey(user.classId, now), params.amount, params.userId);
    await this.applyStreakForActivity(params.userId, now);
    await this.evaluateBadges(params.userId);
  }

  async totalXp(userId: string): Promise<number> {
    const agg = await this.prisma.xpEvent.aggregate({ where: { userId }, _sum: { amount: true } });
    return agg._sum.amount ?? 0;
  }

  private async applyStreakForActivity(userId: string, now: Date): Promise<void> {
    const next = StreakService.onLessonCompleted(await this.readStreakState(userId), now);
    await this.prisma.streak.upsert({
      where: { userId },
      update: { current: next.current, longest: next.longest, lastActivityDate: next.lastActiveDate },
      create: { userId, current: next.current, longest: next.longest, lastActivityDate: next.lastActiveDate },
    });
  }

  /** Streak untuk DITAMPILKAN (mis. GET /path): terapkan peluruhan pasif
   * (StreakService.evaluate -- "putus kalau ada satu hari penuh tanpa
   * aktivitas") dulu. Beda dari applyStreakForActivity yang dipanggil saat
   * XP BENAR-BENAR didapat (onLessonCompleted). Menyimpan balik ke DB kalau
   * peluruhan mengubah nilainya, supaya baris tidak diam-diam basi. */
  async currentStreak(userId: string): Promise<{ current: number; longest: number }> {
    const row = await this.prisma.streak.findUnique({ where: { userId } });
    if (!row) return { current: 0, longest: 0 };

    const evaluated = StreakService.evaluate(
      { current: row.current, longest: row.longest, lastActiveDate: row.lastActivityDate ?? undefined },
      new Date(),
    );
    if (evaluated.current !== row.current) {
      await this.prisma.streak.update({ where: { userId }, data: { current: evaluated.current } });
    }
    return { current: evaluated.current, longest: evaluated.longest };
  }

  private async readStreakState(userId: string): Promise<StreakState> {
    const row = await this.prisma.streak.findUnique({ where: { userId } });
    if (!row) return defaultStreakState;
    return { current: row.current, longest: row.longest, lastActiveDate: row.lastActivityDate ?? undefined };
  }

  private async completedUnitIds(userId: string): Promise<Set<string>> {
    const units = await this.prisma.unit.findMany({ select: { id: true, lessons: { select: { id: true } } } });
    const completed = await this.prisma.userLessonProgress.findMany({
      where: { userId, completedAt: { not: null } },
      select: { lessonId: true },
    });
    const completedLessonIds = new Set(completed.map((p) => p.lessonId));
    const result = new Set<string>();
    for (const u of units) {
      if (u.lessons.length > 0 && u.lessons.every((l) => completedLessonIds.has(l.id))) result.add(u.id);
    }
    return result;
  }

  private async evaluateBadges(userId: string): Promise<void> {
    const [lessonsCompleted, streakRow, existingBadges, completedUnitIds] = await Promise.all([
      this.prisma.userLessonProgress.count({ where: { userId, completedAt: { not: null } } }),
      this.prisma.streak.findUnique({ where: { userId } }),
      this.prisma.userBadge.findMany({ where: { userId }, select: { badge: { select: { code: true } } } }),
      this.completedUnitIds(userId),
    ]);

    const ctx: BadgeContext = {
      lessonsCompleted,
      streakCurrent: streakRow?.current ?? 0,
      // wordsLearned/speakingHighCount: tidak ada tracking persisten untuk ini
      // di skema saat ini (speak dihapus total dari sistem exercise baru;
      // "kata dipelajari" per-user butuh tabel baru yang belum dibangun --
      // lihat docs/PLAN.md). 0 di sini JUJUR, bukan "belum dihitung" -- badge
      // words100/speaker50 memang belum bisa didapat sampai itu ada.
      wordsLearned: 0,
      speakingHighCount: 0,
      completedUnitIds,
      awarded: new Set(existingBadges.map((b) => b.badge.code)),
    };

    const newlyEarned = BadgeService.evaluate(ctx);
    if (newlyEarned.length === 0) return;

    // Badge yang belum ada baris Badge-nya (mis. badge unit conversation yang
    // kontennya belum di-seed) sengaja dilewati, bukan error -- evaluate()
    // lain kali (setelah konten itu ada) akan menangkapnya lagi.
    const badgeRows = await this.prisma.badge.findMany({ where: { code: { in: newlyEarned } } });
    if (badgeRows.length === 0) return;

    await this.prisma.userBadge.createMany({
      data: badgeRows.map((b) => ({ userId, badgeId: b.id })),
      skipDuplicates: true,
    });
  }

  /** GAM-05: mingguan, per kelas (bukan global), berdasar XP minggu berjalan
   * (bukan XP total). Top 50 cukup untuk ukuran kelas kursus. "3 teratas
   * dapat lencana mingguan" BELUM diimplementasikan -- butuh job terjadwal
   * di rollover minggu (@nestjs/schedule belum jadi dependency), lihat
   * docs/PLAN.md. */
  async classLeaderboard(userId: string): Promise<{ weekOf: string; entries: LeaderboardEntry[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { classId: true } });
    const now = new Date();
    const raw = await this.redis.zrevrange(this.leaderboardKey(user.classId, now), 0, 49, "WITHSCORES");

    const ranked: { userId: string; xp: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      ranked.push({ userId: raw[i]!, xp: Number(raw[i + 1]) });
    }

    const names = await this.prisma.user.findMany({
      where: { id: { in: ranked.map((r) => r.userId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(names.map((n) => [n.id, n.name]));

    return {
      weekOf: weekKey(now),
      entries: ranked.map((r, i) => ({ userId: r.userId, name: nameById.get(r.userId) ?? "?", xp: r.xp, rank: i + 1 })),
    };
  }
}
