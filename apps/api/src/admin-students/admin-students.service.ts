import { HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { dateKey, XpService } from "@elearning/domain";
import { PrismaService } from "../prisma/prisma.service";
import { FORGOT_EMAIL_LIMIT } from "../auth/auth.const";
import { AuthService } from "../auth/auth.service";
import { AdminClassesService } from "../admin-classes/admin-classes.service";
import { GamificationService } from "../gamification/gamification.service";
import type { ListStudentsQueryDto, UpdateStudentDto } from "./dto/update-student.dto";
import type { StudentDetailDto, StudentListItemDto, StudentProgressDto } from "./dto/student-view.dto";

const HEATMAP_WINDOW_DAYS = 90;

/** ADM-21/22/31: daftar+detail murid, pindah kelas/nonaktifkan, reset
 * password bantuan, progres belajar untuk halaman detail murid admin. */
@Injectable()
export class AdminStudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly classes: AdminClassesService,
    private readonly gamification: GamificationService,
  ) {}

  async list(query: ListStudentsQueryDto): Promise<StudentListItemDto[]> {
    const users = await this.prisma.user.findMany({
      where: { classId: query.classId },
      select: { id: true, name: true, email: true, status: true, lastActiveAt: true, createdAt: true, class: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);
    const [xpAgg, streaks] = await Promise.all([
      this.prisma.xpEvent.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _sum: { amount: true } }),
      this.prisma.streak.findMany({ where: { userId: { in: userIds } }, select: { userId: true, current: true } }),
    ]);
    const xpByUser = new Map(xpAgg.map((x) => [x.userId, x._sum.amount ?? 0]));
    const streakByUser = new Map(streaks.map((s) => [s.userId, s.current]));

    return users.map((u) => ({ ...u, totalXp: xpByUser.get(u.id) ?? 0, streak: streakByUser.get(u.id) ?? 0 }));
  }

  async detail(id: string): Promise<StudentDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        avatarUrl: true,
        dailyXpGoal: true,
        lastActiveAt: true,
        createdAt: true,
        class: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException(`Murid tidak ditemukan: ${id}`);
    return user;
  }

  async update(id: string, dto: UpdateStudentDto): Promise<StudentDetailDto> {
    await this.assertExists(id);
    if (dto.classId) await this.classes.assertActiveClass(dto.classId);
    await this.prisma.user.update({ where: { id }, data: { classId: dto.classId, status: dto.status } });
    return this.detail(id);
  }

  /** ADM-22: admin trigger kirim ulang email reset password. Reuse
   * AuthService.forgotPassword (jalur token+email yang SAMA dipakai murid
   * sendiri) -- di sini aman dipanggil dengan email yang sudah pasti valid
   * (baris User sudah dikonfirmasi ada), beda dari endpoint publik /auth/forgot
   * yang sengaja tidak pernah membocorkan status "email terdaftar atau tidak". */
  async triggerPasswordReset(id: string): Promise<void> {
    const user = await this.assertExists(id);
    const outcome = await this.auth.requestPasswordReset(user.email);
    // Endpoint publik sengaja diam saat kena batas per-email (anti-enumerasi); di sini pemanggilnya
    // admin yang sudah terautentikan dan barisnya pasti ada, jadi jawab JUJUR -- "terkirim" padahal
    // tidak akan menyesatkan admin.
    if (outcome === "THROTTLED") {
      throw new HttpException(
        `Reset password untuk murid ini sudah diminta terlalu sering (maksimal ${FORGOT_EMAIL_LIMIT} kali per jam). Coba lagi nanti.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** ADM-31: statistik untuk halaman detail murid -- level/XP/streak, progres
   * per unit, skor percakapan per skenario, aktivitas 90 hari terakhir
   * (dipakai untuk heatmap DAN daftar "recent activity" sekaligus, satu
   * query). Pronunciation (Fase 2) TETAP tidak ada di sini -- belum
   * dibangun sama sekali, tidak ada data untuk itu (jujur, bukan field
   * dihilangkan diam-diam). `scenarioProgress` BARU sesi ini -- GAP yang
   * dicatat sejak bagian 6c (ScenarioAttempt sudah ada sejak Milestone 9
   * lanjutan tapi belum disertakan di sini) sekarang ditutup. */
  async progress(id: string): Promise<StudentProgressDto> {
    await this.assertExists(id);

    const since = new Date(Date.now() - HEATMAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [progressRows, scenarioAttempts, streak, xpTotal, recentEvents] = await Promise.all([
      this.prisma.userLessonProgress.findMany({
        where: { userId: id },
        include: { lesson: { select: { title: true, unit: { select: { id: true, title: true } } } } },
      }),
      this.prisma.scenarioAttempt.findMany({
        where: { userId: id },
        include: { scenario: { select: { titleJp: true, titleId: true } } },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.streak.findUnique({ where: { userId: id } }),
      this.gamification.totalXp(id),
      this.prisma.xpEvent.findMany({ where: { userId: id, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } }),
    ]);

    const unitProgress = new Map<string, { unitId: string; unitTitle: string; completedLessons: number; totalStars: number }>();
    for (const p of progressRows) {
      if (!p.completedAt) continue;
      const u = p.lesson.unit;
      const entry = unitProgress.get(u.id) ?? { unitId: u.id, unitTitle: u.title, completedLessons: 0, totalStars: 0 };
      entry.completedLessons++;
      entry.totalStars += p.stars;
      unitProgress.set(u.id, entry);
    }

    // Digabung per skenario (bukan daftar attempt mentah) -- skor TERBAIK
    // lintas mode PRACTICE+TEST, konsisten dengan "bintang terbaik" di
    // unitProgress di atas. attempts dihitung dari SEMUA percobaan (retry
    // practice tanpa batas ikut terhitung, itu sengaja -- menunjukkan
    // seberapa sering murid berlatih, bukan cuma seberapa sering "lulus").
    const scenarioProgress = new Map<string, { scenarioId: string; titleJp: string; titleId: string; attempts: number; bestScore: number; lastAttemptAt: Date }>();
    for (const a of scenarioAttempts) {
      const entry = scenarioProgress.get(a.scenarioId) ?? {
        scenarioId: a.scenarioId,
        titleJp: a.scenario.titleJp,
        titleId: a.scenario.titleId,
        attempts: 0,
        bestScore: 0,
        lastAttemptAt: a.createdAt,
      };
      entry.attempts++;
      entry.bestScore = Math.max(entry.bestScore, a.score);
      if (a.createdAt > entry.lastAttemptAt) entry.lastAttemptAt = a.createdAt;
      scenarioProgress.set(a.scenarioId, entry);
    }

    const heatmap = new Map<string, number>();
    for (const e of recentEvents) {
      const day = dateKey(e.createdAt);
      heatmap.set(day, (heatmap.get(day) ?? 0) + e.amount);
    }

    return {
      xpTotal,
      level: XpService.levelForXp(xpTotal),
      streak: streak ? { current: streak.current, longest: streak.longest } : { current: 0, longest: 0 },
      unitProgress: [...unitProgress.values()].map((u) => ({ ...u, averageStars: u.totalStars / u.completedLessons })),
      scenarioProgress: [...scenarioProgress.values()],
      recentActivity: recentEvents.slice(0, 50).map((e) => ({ source: e.source, amount: e.amount, refId: e.refId, at: e.createdAt })),
      activityHeatmap: [...heatmap.entries()].map(([date, xp]) => ({ date, xp })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  private async assertExists(id: string): Promise<{ id: string; email: string }> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!user) throw new NotFoundException(`Murid tidak ditemukan: ${id}`);
    return user;
  }
}
