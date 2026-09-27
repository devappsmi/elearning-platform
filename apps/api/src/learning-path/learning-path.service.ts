import { Injectable } from "@nestjs/common";
import type { UnitType as PrismaUnitType } from "@prisma/client";
import { completedLessonCount, deriveNodeStates, UnlockRules, type Lesson as DomainLesson, type Unit as DomainUnit } from "@elearning/domain";
import { PrismaService } from "../prisma/prisma.service";
import { GamificationService } from "../gamification/gamification.service";
import { PathLessonView, PathLevelView, PathUnitView, PathView } from "./dto/path-view.dto";

interface LessonRow {
  id: string;
  title: string;
  order: number;
  isCheckpoint: boolean;
}

interface UnitRow {
  id: string;
  title: string;
  order: number;
  type: PrismaUnitType;
  lessons: LessonRow[];
}

/** Stand-in domain Unit/Lesson yang CUKUP untuk unlockRules/pathLayout
 * (cuma menyentuh .id dan .lessons[].id) -- bukan rekonstruksi penuh seperti
 * ContentService (yang juga memuat vocab/sentences/exercises, mahal untuk
 * dipanggil per-unit lintas SELURUH kurikulum hanya demi status lock/unlock). */
function toStubUnit(u: UnitRow): DomainUnit {
  const lessons: DomainLesson[] = u.lessons.map((l) => ({ id: l.id, title: l.title, exercises: [] }));
  return {
    id: u.id,
    order: u.order,
    title: u.title,
    description: "",
    type: u.type === "CONVERSATION" ? "conversation" : "kana",
    grammarNotes: [],
    vocab: [],
    sentences: [],
    lessons,
  };
}

/** LP-01/02: peta learning path lintas SELURUH level -- unit/lesson terkunci
 * berurutan (UnlockRules) memperlakukan semua unit lintas level sebagai SATU
 * urutan linear (lihat catatan di docs/PLAN.md soal kenapa unit percakapan
 * otomatis butuh Hiragana+Katakana tuntas transitif). */
@Injectable()
export class LearningPathService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async getPath(userId: string): Promise<PathView> {
    const levels = await this.prisma.level.findMany({
      orderBy: { order: "asc" },
      include: {
        units: {
          orderBy: { order: "asc" },
          include: { lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, order: true, isCheckpoint: true } } },
        },
      },
    });

    const completedProgress = await this.prisma.userLessonProgress.findMany({
      where: { userId, completedAt: { not: null } },
      select: { lessonId: true, stars: true },
    });
    const starsByLessonId = new Map(completedProgress.map((p) => [p.lessonId, p.stars]));

    const flatUnits = levels.flatMap((lv) => lv.units.map((u) => toStubUnit(u)));
    const completedLessonKeys = new Set<string>();
    for (const u of flatUnits) {
      for (const l of u.lessons) {
        if (starsByLessonId.has(l.id)) completedLessonKeys.add(UnlockRules.lessonKey(u, l));
      }
    }

    let continueLessonId: string | null = null;
    let globalIndex = 0;
    const levelsOut: PathLevelView[] = [];

    for (const lv of levels) {
      const unitsOut: PathUnitView[] = [];
      for (const u of lv.units) {
        const domainUnit = flatUnits[globalIndex]!;
        const unitUnlocked = UnlockRules.isUnitUnlocked(flatUnits, globalIndex, completedLessonKeys);
        const nodeStates = deriveNodeStates(domainUnit, unitUnlocked, completedLessonKeys);

        const lessonsOut: PathLessonView[] = u.lessons.map((l, i) => {
          const state = nodeStates[i]!;
          if (continueLessonId === null && state === "available") continueLessonId = l.id;
          return { id: l.id, title: l.title, order: l.order, isCheckpoint: l.isCheckpoint, state, stars: starsByLessonId.get(l.id) ?? null };
        });

        unitsOut.push({
          id: u.id,
          title: u.title,
          order: u.order,
          type: u.type === "CONVERSATION" ? "conversation" : "kana",
          unlocked: unitUnlocked,
          completedLessons: completedLessonCount(domainUnit, completedLessonKeys),
          totalLessons: u.lessons.length,
          lessons: lessonsOut,
        });
        globalIndex++;
      }
      levelsOut.push({ id: lv.id, code: lv.code, name: lv.name, order: lv.order, units: unitsOut });
    }

    const streak = await this.gamification.currentStreak(userId);
    return { levels: levelsOut, continueLessonId, streak };
  }
}
