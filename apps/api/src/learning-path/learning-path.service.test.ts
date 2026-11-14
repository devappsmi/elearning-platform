import { describe, expect, it, vi } from "vitest";
import type { GamificationService } from "../gamification/gamification.service";
import type { PrismaService } from "../prisma/prisma.service";
import { LearningPathService } from "./learning-path.service";

// Unit awal dari tes penempatan (AUTH-05, docs/PLAN.md bagian 7q) di peta GET /path.

const lesson = (id: string, order: number) => ({ id, title: id, order, isCheckpoint: false });
const LEVELS = [
  { id: "lv1", code: "HIRAGANA", name: "Hiragana", order: 1, units: [{ id: "unit_hiragana", title: "Hiragana", order: 1, type: "KANA", lessons: [lesson("l1", 0), lesson("l2", 1)] }] },
  { id: "lv5", code: "N4", name: "N4", order: 5, units: [{ id: "unit_kerja_3", title: "Kerja", order: 3, type: "CONVERSATION", lessons: [lesson("k1", 0), lesson("k2", 1)] }] },
];

function service(startUnitId: string | null, completedLessonIds: string[] = []) {
  const prisma = {
    level: { findMany: vi.fn(async () => LEVELS) },
    userLessonProgress: { findMany: vi.fn(async () => completedLessonIds.map((lessonId) => ({ lessonId, stars: 3 }))) },
    user: { findUniqueOrThrow: vi.fn(async () => ({ placementStartUnitId: startUnitId })) },
  };
  const gamification = { currentStreak: vi.fn(async () => ({ current: 0, longest: 0 })) };
  return new LearningPathService(prisma as unknown as PrismaService, gamification as unknown as GamificationService);
}

const units = (path: Awaited<ReturnType<LearningPathService["getPath"]>>) => path.levels.flatMap((lv) => lv.units);

describe("LearningPathService.getPath dengan tes penempatan", () => {
  it("tanpa hasil tes: berurutan seperti biasa, tidak ada yang dilewati", async () => {
    const path = await service(null).getPath("u1");

    expect(units(path).map((u) => [u.id, u.unlocked, u.skipped])).toEqual([
      ["unit_hiragana", true, false],
      ["unit_kerja_3", false, false],
    ]);
    expect(path.continueLessonId).toBe("l1");
  });

  it("lulus tes: Hiragana dilewati tapi tetap terbuka; unit awal terbuka; Lanjutkan Belajar ke unit awal", async () => {
    const path = await service("unit_kerja_3").getPath("u1");
    const [hira, kerja] = units(path);

    expect(hira).toMatchObject({ unlocked: true, skipped: true, completedLessons: 0 });
    expect(hira!.lessons.map((l) => l.state)).toEqual(["available", "locked"]);
    expect(kerja).toMatchObject({ unlocked: true, skipped: false });
    expect(kerja!.lessons.map((l) => l.state)).toEqual(["available", "locked"]);
    expect(path.continueLessonId).toBe("k1");
  });

  it("unit awal sudah tamat: Lanjutkan Belajar kembali ke unit yang dilewati", async () => {
    const path = await service("unit_kerja_3", ["k1", "k2"]).getPath("u1");

    expect(path.continueLessonId).toBe("l1");
  });

  it("unit awal sudah tidak ada di jalur (dihapus): diperlakukan seperti mulai dari awal", async () => {
    const path = await service("unit_lama").getPath("u1");

    expect(units(path).map((u) => [u.unlocked, u.skipped])).toEqual([
      [true, false],
      [false, false],
    ]);
  });
});
