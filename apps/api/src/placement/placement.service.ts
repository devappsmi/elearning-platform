import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, GoneException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { UnitType as PrismaUnitType } from "@prisma/client";
import type Redis from "ioredis";
import {
  buildPlacementTest,
  gradePlacement,
  placementAnswerKey,
  planPlacement,
  PLACEMENT_PASS_PERCENT,
  PLACEMENT_QUESTION_COUNT,
  UnlockRules,
  type PlacementAnswerKey,
  type PlacementPlan,
  type Unit as DomainUnit,
} from "@elearning/domain";
import type { Env } from "../config/env.validation";
import { ContentService } from "../content/content.service";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS_CLIENT } from "../redis/redis.module";
import type {
  PlacementAttemptResultView,
  PlacementOutcomeView,
  PlacementStatusView,
  PlacementTestView,
  PlacementUnitView,
  SubmitPlacementDto,
} from "./dto/placement.dto";

/** Waktu mengerjakan satu tes sebelum kuncinya kedaluwarsa. */
export const PLACEMENT_TEST_TTL_SECONDS = 2 * 60 * 60;

const DISABLED = "Tes penempatan sedang dimatikan.";
const ALREADY_TAKEN = "Tes penempatan hanya bisa diambil sekali.";

interface PathUnit {
  id: string;
  title: string;
  type: PrismaUnitType;
  levelName: string;
}

interface PlacementUserRow {
  placementTakenAt: Date | null;
  placementCorrect: number | null;
  placementTotal: number | null;
  placementStartUnitId: string | null;
}

/** Kunci jawaban satu tes yang sedang dikerjakan -- hanya di server (Redis), satu per murid. */
interface StoredTest {
  testId: string;
  sectionUnitIds: string[];
  nextUnitId: string;
  key: PlacementAnswerKey[];
}

function testKey(userId: string): string {
  return `placement_test:${userId}`;
}

/** Unit domain minimal untuk unit sesudah kandidat seksi: planPlacement hanya membaca id dan type-nya. */
function stubUnit(u: PathUnit): DomainUnit {
  return {
    id: u.id,
    order: 0,
    title: u.title,
    description: "",
    type: u.type === "CONVERSATION" ? "conversation" : "kana",
    grammarNotes: [],
    vocab: [],
    sentences: [],
    lessons: [],
  };
}

/** Tes penempatan (PRD AUTH-05): GET status, POST mulai tes, POST kirim jawaban. Soal dibuat dan dinilai dengan
 * fungsi domain yang sama (packages/domain/src/placement); di sini cuma penegakan aturannya:
 *
 * - Hanya sekali per murid, sebelum menyelesaikan pelajaran pertama, dan selama env PLACEMENT_TEST_ENABLED menyala.
 * - Kunci jawaban TIDAK pernah dikirim ke browser: disimpan di Redis (`placement_test:<userId>`, kedaluwarsa 2 jam)
 *   dan dibandingkan saat jawaban dikirim. Memulai tes lagi mengganti tes sebelumnya.
 * - Hasilnya disimpan di users.placement_* (start unit null = mulai dari awal); penulisannya bersyarat
 *   `placementTakenAt: null`, jadi dua kiriman bersamaan tidak bisa sama-sama tercatat.
 * - Unit sebelum unit awal DILEWATI: tetap terbuka, tidak lagi jadi syarat (UnlockRules, dipakai LearningPathService
 *   dan ContentService.assertLessonUnlocked). */
@Injectable()
export class PlacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get enabled(): boolean {
    return this.config.get("PLACEMENT_TEST_ENABLED", { infer: true });
  }

  async status(userId: string): Promise<PlacementStatusView> {
    const [user, units, completedLessons] = await Promise.all([this.loadUser(userId), this.pathUnits(), this.completedLessons(userId)]);
    const eligible = this.enabled && user.placementTakenAt === null && completedLessons === 0;
    const plan = eligible ? await this.plan(units) : null;
    return {
      enabled: this.enabled,
      available: plan !== null,
      questionCount: plan ? buildPlacementTest(plan).length : PLACEMENT_QUESTION_COUNT,
      passPercent: PLACEMENT_PASS_PERCENT,
      sections: plan ? plan.sections.map((u) => this.unitView(units, u.id)!) : [],
      result: user.placementTakenAt ? this.outcome({ ...user, placementTakenAt: user.placementTakenAt }, units) : null,
    };
  }

  async createTest(userId: string): Promise<PlacementTestView> {
    if (!this.enabled) throw new ForbiddenException(DISABLED);
    const [user, units, completedLessons] = await Promise.all([this.loadUser(userId), this.pathUnits(), this.completedLessons(userId)]);
    if (user.placementTakenAt) throw new ConflictException(ALREADY_TAKEN);
    if (completedLessons > 0) throw new ConflictException("Tes penempatan hanya untuk murid yang belum menyelesaikan satu pelajaran pun.");
    const plan = await this.plan(units);
    if (!plan) throw new ConflictException("Belum ada unit yang bisa dilewati lewat tes penempatan.");

    const questions = buildPlacementTest(plan);
    const stored: StoredTest = {
      testId: randomUUID(),
      sectionUnitIds: plan.sections.map((u) => u.id),
      nextUnitId: plan.nextUnit.id,
      key: placementAnswerKey(questions),
    };
    await this.redis.set(testKey(userId), JSON.stringify(stored), "EX", PLACEMENT_TEST_TTL_SECONDS);

    return {
      testId: stored.testId,
      expiresAt: new Date(Date.now() + PLACEMENT_TEST_TTL_SECONDS * 1000),
      passPercent: PLACEMENT_PASS_PERCENT,
      sections: plan.sections.map((u) => ({
        unitId: u.id,
        title: u.title,
        questionCount: questions.filter((q) => q.sectionUnitId === u.id).length,
      })),
      // Dipetakan field demi field (bukan spread) supaya correctIndex/refId tidak mungkin ikut terkirim.
      questions: questions.map((q, i) => ({
        id: `q${i + 1}`,
        sectionUnitId: q.sectionUnitId,
        kind: q.kind,
        prompt: q.prompt,
        ...(q.promptSub === undefined ? {} : { promptSub: q.promptSub }),
        options: q.options.map((o) => (o.sub === undefined ? { text: o.text } : { text: o.text, sub: o.sub })),
      })),
    };
  }

  async submit(userId: string, dto: SubmitPlacementDto): Promise<PlacementAttemptResultView> {
    if (!this.enabled) throw new ForbiddenException(DISABLED);
    const raw = await this.redis.get(testKey(userId));
    const stored = raw === null ? null : (JSON.parse(raw) as StoredTest);
    if (!stored || stored.testId !== dto.testId) {
      throw new GoneException("Tes ini sudah kedaluwarsa atau sudah diganti tes yang lebih baru. Mulai tes lagi.");
    }
    if (dto.answers.length !== stored.key.length) {
      throw new BadRequestException(`Jumlah jawaban harus ${stored.key.length}, dapat ${dto.answers.length}`);
    }

    // choiceText kosong/null = "Belum tahu".
    const grade = gradePlacement(stored, dto.answers.map((a) => a.choiceText || null));
    const result: PlacementUserRow & { placementTakenAt: Date } = {
      placementTakenAt: new Date(),
      placementCorrect: grade.correct,
      placementTotal: grade.total,
      placementStartUnitId: grade.startUnitId,
    };
    const { count } = await this.prisma.user.updateMany({ where: { id: userId, placementTakenAt: null }, data: result });
    await this.redis.del(testKey(userId));
    if (count === 0) throw new ConflictException(ALREADY_TAKEN);

    const units = await this.pathUnits();
    return {
      ...this.outcome(result, units),
      passPercent: PLACEMENT_PASS_PERCENT,
      sections: grade.sections.map((s) => ({ ...s, title: units.find((u) => u.id === s.unitId)?.title ?? s.unitId })),
    };
  }

  private async loadUser(userId: string): Promise<PlacementUserRow> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { placementTakenAt: true, placementCorrect: true, placementTotal: true, placementStartUnitId: true },
    });
  }

  private completedLessons(userId: string): Promise<number> {
    return this.prisma.userLessonProgress.count({ where: { userId, completedAt: { not: null } } });
  }

  /** Seluruh unit jalur belajar, urut level lalu unit -- urutan yang sama dengan LearningPathService. */
  private async pathUnits(): Promise<PathUnit[]> {
    const rows = await this.prisma.unit.findMany({
      orderBy: [{ level: { order: "asc" } }, { order: "asc" }],
      select: { id: true, title: true, type: true, level: { select: { name: true } } },
    });
    return rows.map((u) => ({ id: u.id, title: u.title, type: u.type, levelName: u.level.name }));
  }

  /** Hanya unit huruf di awal jalur (calon seksi) yang dimuat lengkap; unit sesudahnya cukup id + type. */
  private async plan(units: PathUnit[]): Promise<PlacementPlan | null> {
    let leading = 0;
    while (leading < units.length - 1 && units[leading]!.type === "KANA") leading++;
    if (leading === 0) return null;
    const candidates = await Promise.all(units.slice(0, leading).map((u) => this.content.loadUnit(u.id)));
    return planPlacement([...candidates, stubUnit(units[leading]!)]);
  }

  private unitView(units: PathUnit[], unitId: string): PlacementUnitView | null {
    const unit = units.find((u) => u.id === unitId);
    return unit ? { id: unit.id, title: unit.title, levelName: unit.levelName } : null;
  }

  private outcome(user: PlacementUserRow & { placementTakenAt: Date }, units: PathUnit[]): PlacementOutcomeView {
    const startIndex = UnlockRules.startIndexOf(units, user.placementStartUnitId);
    const start = units[startIndex];
    return {
      takenAt: user.placementTakenAt,
      correct: user.placementCorrect ?? 0,
      total: user.placementTotal ?? 0,
      startUnit: start ? this.unitView(units, start.id) : null,
      skippedUnits: units.slice(0, startIndex).map((u) => this.unitView(units, u.id)!),
    };
  }
}
