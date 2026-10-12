import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const ACTIVE_WINDOW_DAYS = 7;

export type StreakBucket = "0" | "1-3" | "4-7" | "8-14" | "15-30" | "30+";

export function bucketStreak(current: number): StreakBucket {
  if (current === 0) return "0";
  if (current <= 3) return "1-3";
  if (current <= 7) return "4-7";
  if (current <= 14) return "8-14";
  if (current <= 30) return "15-30";
  return "30+";
}

/** ADM-30: kartu ringkasan dashboard admin. Semua dihitung langsung dari
 * tabel yang sudah ada (tidak ada agregat tersimpan/cache) -- wajar untuk
 * skala ±50-500 murid per NFR, tidak butuh materialized view. */
@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [activeThisWeek, activeUsers, xpAgg, totalLessons, classes] = await Promise.all([
      this.prisma.user.count({ where: { status: "ACTIVE", lastActiveAt: { gte: activeSince } } }),
      this.prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } }),
      this.prisma.xpEvent.groupBy({ by: ["userId"], _sum: { amount: true } }),
      this.prisma.lesson.count(),
      this.prisma.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, _count: { select: { students: true } } } }),
    ]);

    const totalXpAcrossUsers = xpAgg.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
    const averageXp = xpAgg.length > 0 ? Math.round(totalXpAcrossUsers / xpAgg.length) : 0;

    // Streak diquery TERPISAH dan digabung manual (bukan `include` dari User)
    // supaya murid yang belum PERNAH dapat XP (belum ada baris Streak sama
    // sekali -- lihat GamificationService.applyStreakForActivity, upsert
    // cuma jalan lewat awardXp) tetap terhitung di bucket "0", bukan hilang
    // diam-diam dari distribusi (ketahuan pas verifikasi manual: murid baru
    // daftar tidak muncul di mana pun kalau cuma query tabel Streak langsung).
    const streaks = await this.prisma.streak.findMany({
      where: { userId: { in: activeUsers.map((u) => u.id) } },
      select: { userId: true, current: true },
    });
    const streakByUser = new Map(streaks.map((s) => [s.userId, s.current]));
    const streakDistribution: Record<StreakBucket, number> = { "0": 0, "1-3": 0, "4-7": 0, "8-14": 0, "15-30": 0, "30+": 0 };
    for (const u of activeUsers) streakDistribution[bucketStreak(streakByUser.get(u.id) ?? 0)]++;

    const lessonCompletionRateByClass = await Promise.all(
      classes.map(async (c) => {
        const studentCount = c._count.students;
        if (studentCount === 0 || totalLessons === 0) {
          return { classId: c.id, className: c.name, studentCount, completionRate: 0 };
        }
        const completedCount = await this.prisma.userLessonProgress.count({
          where: { completedAt: { not: null }, user: { classId: c.id } },
        });
        return { classId: c.id, className: c.name, studentCount, completionRate: completedCount / (totalLessons * studentCount) };
      }),
    );

    return {
      activeStudentsThisWeek: activeThisWeek,
      totalActiveStudents: activeUsers.length,
      averageXp,
      streakDistribution,
      lessonCompletionRateByClass,
    };
  }
}
