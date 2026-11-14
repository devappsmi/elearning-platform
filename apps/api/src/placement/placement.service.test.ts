import { readFileSync } from "node:fs";
import { BadRequestException, ConflictException, ForbiddenException, GoneException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { unitSchema, type Unit } from "@elearning/domain";
import { describe, expect, it, vi } from "vitest";
import { createFakeRedis } from "../common/fake-redis.testkit";
import type { Env } from "../config/env.validation";
import type { ContentService } from "../content/content.service";
import { seedDataPath } from "../content-import/unit-manifest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SubmitPlacementDto } from "./dto/placement.dto";
import { PLACEMENT_TEST_TTL_SECONDS, PlacementService } from "./placement.service";

// Unit Hiragana SUNGGUHAN (seed-data) supaya soal dibuat dari konten nyata; unit lain cukup baris jalurnya.
const hiragana: Unit = unitSchema.parse(JSON.parse(readFileSync(seedDataPath("raw/unit_hiragana.json"), "utf-8")));

const PATH = [
  { id: "unit_hiragana", title: "Hiragana", type: "KANA", level: { name: "Hiragana" } },
  { id: "unit_kerja_3", title: "Percakapan di Tempat Kerja", type: "CONVERSATION", level: { name: "N4" } },
];

interface UserState {
  placementTakenAt: Date | null;
  placementCorrect: number | null;
  placementTotal: number | null;
  placementStartUnitId: string | null;
}

function setup({ enabled = true, completed = 0, user = {}, path = PATH }: { enabled?: boolean; completed?: number; user?: Partial<UserState>; path?: typeof PATH } = {}) {
  const state: UserState = { placementTakenAt: null, placementCorrect: null, placementTotal: null, placementStartUnitId: null, ...user };
  const prisma = {
    user: {
      findUniqueOrThrow: vi.fn(async () => ({ ...state })),
      updateMany: vi.fn(async ({ where, data }: { where: { placementTakenAt: null }; data: UserState }) => {
        if (where.placementTakenAt !== null || state.placementTakenAt !== null) return { count: 0 };
        Object.assign(state, data);
        return { count: 1 };
      }),
    },
    userLessonProgress: { count: vi.fn(async () => completed) },
    unit: { findMany: vi.fn(async () => path) },
  };
  const content = { loadUnit: vi.fn(async (id: string) => ({ ...hiragana, id })) };
  const redis = createFakeRedis();
  const config = { get: vi.fn(() => enabled) };
  const service = new PlacementService(
    prisma as unknown as PrismaService,
    content as unknown as ContentService,
    redis as never,
    config as unknown as ConfigService<Env, true>,
  );
  const stored = () => JSON.parse(redis.store.get("placement_test:u1")!) as { testId: string; key: { correct: string }[] };
  return { service, prisma, content, redis, state, stored };
}

const answersFrom = (texts: (string | null)[]): SubmitPlacementDto["answers"] => texts.map((choiceText) => ({ choiceText }));

describe("PlacementService.status", () => {
  it("murid baru: tes tersedia untuk melewati Hiragana, 15 soal, ambang 80%", async () => {
    const { service } = setup();

    await expect(service.status("u1")).resolves.toEqual({
      enabled: true,
      available: true,
      questionCount: 15,
      passPercent: 80,
      sections: [{ id: "unit_hiragana", title: "Hiragana", levelName: "Hiragana" }],
      result: null,
    });
  });

  it("dimatikan lewat env: tidak tersedia, dan konten tidak dimuat sama sekali", async () => {
    const { service, content } = setup({ enabled: false });

    await expect(service.status("u1")).resolves.toMatchObject({ enabled: false, available: false, sections: [] });
    expect(content.loadUnit).not.toHaveBeenCalled();
  });

  it("sudah menyelesaikan pelajaran: tidak tersedia", async () => {
    const { service } = setup({ completed: 1 });

    await expect(service.status("u1")).resolves.toMatchObject({ available: false, result: null });
  });

  it("jalur tidak diawali unit huruf: tidak tersedia", async () => {
    const { service } = setup({ path: [PATH[1]!, PATH[0]!] });

    await expect(service.status("u1")).resolves.toMatchObject({ enabled: true, available: false, sections: [] });
  });

  it("sudah ikut dan lulus: hasil memuat unit awal dan unit yang dilewati", async () => {
    const takenAt = new Date("2026-10-12T05:00:00.000Z");
    const { service } = setup({ user: { placementTakenAt: takenAt, placementCorrect: 13, placementTotal: 15, placementStartUnitId: "unit_kerja_3" } });

    await expect(service.status("u1")).resolves.toMatchObject({
      available: false,
      result: {
        takenAt,
        correct: 13,
        total: 15,
        startUnit: { id: "unit_kerja_3", title: "Percakapan di Tempat Kerja", levelName: "N4" },
        skippedUnits: [{ id: "unit_hiragana", title: "Hiragana", levelName: "Hiragana" }],
      },
    });
  });

  it("sudah ikut tapi tidak lulus: mulai dari unit pertama, tidak ada yang dilewati; tetap terlihat walau fitur dimatikan", async () => {
    const { service } = setup({ enabled: false, user: { placementTakenAt: new Date(), placementCorrect: 4, placementTotal: 15 } });

    await expect(service.status("u1")).resolves.toMatchObject({
      available: false,
      result: { correct: 4, startUnit: { id: "unit_hiragana" }, skippedUnits: [] },
    });
  });
});

describe("PlacementService.createTest", () => {
  it("soal yang dikirim tanpa kunci jawaban; kuncinya di Redis dengan TTL 2 jam", async () => {
    const { service, redis, stored } = setup();

    const test = await service.createTest("u1");

    expect(test.questions).toHaveLength(15);
    expect(test.sections).toEqual([{ unitId: "unit_hiragana", title: "Hiragana", questionCount: 15 }]);
    expect(test.questions.map((q) => q.id)).toEqual(Array.from({ length: 15 }, (_, i) => `q${i + 1}`));
    for (const q of test.questions) {
      expect(Object.keys(q).sort()).toEqual(expect.arrayContaining(["id", "kind", "options", "prompt", "sectionUnitId"]));
      expect(q).not.toHaveProperty("correctIndex");
      expect(q).not.toHaveProperty("refId");
    }
    expect(JSON.stringify(test)).not.toMatch(/correct|"k_|"w_/); // tidak ada kunci, tidak ada id kosakata/kata

    expect(redis.ttls.get("placement_test:u1")).toBe(PLACEMENT_TEST_TTL_SECONDS);
    const key = stored();
    expect(key.testId).toBe(test.testId);
    expect(key.key).toHaveLength(15);
    key.key.forEach((k, i) => expect(test.questions[i]!.options.map((o) => o.text)).toContain(k.correct));
  });

  it.each([
    ["fitur dimatikan", { enabled: false }, ForbiddenException],
    ["sudah pernah ikut", { user: { placementTakenAt: new Date() } }, ConflictException],
    ["sudah menyelesaikan pelajaran", { completed: 2 }, ConflictException],
    ["tidak ada unit yang bisa dilewati", { path: [PATH[1]!] }, ConflictException],
  ] as const)("ditolak bila %s", async (_name, options, error) => {
    const { service, redis } = setup(options as Parameters<typeof setup>[0]);

    await expect(service.createTest("u1")).rejects.toBeInstanceOf(error);
    expect(redis.store.size).toBe(0);
  });
});

describe("PlacementService.submit", () => {
  it("semua benar: lulus Hiragana, mulai di unit berikutnya, kunci di Redis dihapus", async () => {
    const { service, prisma, redis, state, stored } = setup();
    const test = await service.createTest("u1");

    const result = await service.submit("u1", { testId: test.testId, answers: answersFrom(stored().key.map((k) => k.correct)) });

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", placementTakenAt: null },
      data: expect.objectContaining({ placementCorrect: 15, placementTotal: 15, placementStartUnitId: "unit_kerja_3" }),
    });
    expect(state.placementTakenAt).toBeInstanceOf(Date);
    expect(redis.store.has("placement_test:u1")).toBe(false);
    expect(result).toMatchObject({
      correct: 15,
      total: 15,
      passPercent: 80,
      sections: [{ unitId: "unit_hiragana", title: "Hiragana", correct: 15, total: 15, passed: true }],
      startUnit: { id: "unit_kerja_3" },
      skippedUnits: [{ id: "unit_hiragana" }],
    });
  });

  it("12/15 pas di ambang lulus; 11/15 mulai dari awal", async () => {
    for (const [right, start] of [
      [12, "unit_kerja_3"],
      [11, null],
    ] as const) {
      const { service, state, stored } = setup();
      const test = await service.createTest("u1");
      const answers = stored().key.map((k, i) => (i < right ? k.correct : "salah"));

      await service.submit("u1", { testId: test.testId, answers: answersFrom(answers) });

      expect(state).toMatchObject({ placementCorrect: right, placementStartUnitId: start });
    }
  });

  it('"Belum tahu" (null atau string kosong) dinilai salah', async () => {
    const { service, state } = setup();
    const test = await service.createTest("u1");

    const result = await service.submit("u1", { testId: test.testId, answers: answersFrom(test.questions.map((_, i) => (i % 2 ? null : ""))) });

    expect(result).toMatchObject({ correct: 0, startUnit: { id: "unit_hiragana" }, skippedUnits: [] });
    expect(state.placementStartUnitId).toBeNull();
  });

  it("tes yang sudah diganti tes baru atau kedaluwarsa: 410, tidak ada yang tersimpan", async () => {
    const { service, prisma, redis } = setup();
    const first = await service.createTest("u1");
    await service.createTest("u1");

    await expect(service.submit("u1", { testId: first.testId, answers: answersFrom(Array(15).fill(null)) })).rejects.toBeInstanceOf(GoneException);
    redis.store.clear();
    await expect(service.submit("u1", { testId: first.testId, answers: answersFrom(Array(15).fill(null)) })).rejects.toBeInstanceOf(GoneException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("jumlah jawaban harus sama dengan jumlah soal", async () => {
    const { service, prisma } = setup();
    const test = await service.createTest("u1");

    await expect(service.submit("u1", { testId: test.testId, answers: answersFrom(Array(14).fill(null)) })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("kiriman kedua (mis. dua tab) ditolak 409 dan hasil pertama tidak tertimpa", async () => {
    const { service, state, redis, stored } = setup();
    const test = await service.createTest("u1");
    const body = { testId: test.testId, answers: answersFrom(stored().key.map((k) => k.correct)) };
    const keyBackup = redis.store.get("placement_test:u1")!;

    await service.submit("u1", body);
    redis.store.set("placement_test:u1", keyBackup); // kiriman kedua sempat membaca kunci sebelum dihapus
    await expect(service.submit("u1", { ...body, answers: answersFrom(Array(15).fill(null)) })).rejects.toBeInstanceOf(ConflictException);

    expect(state).toMatchObject({ placementCorrect: 15, placementStartUnitId: "unit_kerja_3" });
  });

  it("fitur dimatikan setelah tes dimulai: 403", async () => {
    const { service } = setup({ enabled: false });

    await expect(service.submit("u1", { testId: "00000000-0000-4000-8000-000000000000", answers: [] })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
