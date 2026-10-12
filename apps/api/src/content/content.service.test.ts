import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { ContentService } from "./content.service";

// Penegakan kunci pelajaran di server (POST /lessons/:id/attempts) harus sama dengan peta GET /path, termasuk unit
// awal dari tes penempatan (AUTH-05, docs/PLAN.md bagian 7q).

function service(startUnitId: string | null, completedLessonIds: string[] = []) {
  const prisma = {
    unit: {
      findMany: vi.fn(async () => [
        { id: "unit_hiragana", lessons: [{ id: "l1" }, { id: "l2" }] },
        { id: "unit_kerja_3", lessons: [{ id: "k1" }, { id: "k2" }] },
      ]),
    },
    userLessonProgress: { findMany: vi.fn(async () => completedLessonIds.map((lessonId) => ({ lessonId }))) },
    user: { findUniqueOrThrow: vi.fn(async () => ({ placementStartUnitId: startUnitId })) },
  };
  return new ContentService(prisma as unknown as PrismaService);
}

describe("ContentService.assertLessonUnlocked dengan tes penempatan", () => {
  it("tanpa hasil tes: unit berikutnya terkunci sampai Hiragana tuntas", async () => {
    await expect(service(null).assertLessonUnlocked("u1", "unit_kerja_3", "k1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service(null, ["l1", "l2"]).assertLessonUnlocked("u1", "unit_kerja_3", "k1")).resolves.toBeUndefined();
  });

  it("lulus tes: pelajaran pertama unit awal terbuka, berikutnya tetap berurutan", async () => {
    const lulus = service("unit_kerja_3");

    await expect(lulus.assertLessonUnlocked("u1", "unit_kerja_3", "k1")).resolves.toBeUndefined();
    await expect(lulus.assertLessonUnlocked("u1", "unit_kerja_3", "k2")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("unit yang dilewati tetap bisa dipelajari, berurutan seperti biasa", async () => {
    const lulus = service("unit_kerja_3");

    await expect(lulus.assertLessonUnlocked("u1", "unit_hiragana", "l1")).resolves.toBeUndefined();
    await expect(lulus.assertLessonUnlocked("u1", "unit_hiragana", "l2")).rejects.toBeInstanceOf(ForbiddenException);
  });
});
