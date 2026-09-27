import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { deriveNodeStates, UnlockRules, type Lesson as DomainLesson, type Unit as DomainUnit } from "@elearning/domain";
import { PrismaService } from "../prisma/prisma.service";
import { loadAudioUrlsByHash } from "../audio/audio-lookup.util";
import { audioHashKeysForUnit, toDomainUnit, UNIT_CONTENT_INCLUDE } from "./content.mapper";

/** Stand-in domain Unit minimal -- cukup {id, lessons[].id} untuk unlockRules,
 * lihat catatan yang sama di learning-path.service.ts (dua tempat ini sengaja
 * TIDAK berbagi satu helper: kebutuhan datanya beda -- LearningPathService
 * butuh title/order/isCheckpoint untuk ditampilkan, di sini cuma butuh id
 * untuk satu pertanyaan ya/tidak). */
function toMinimalDomainUnit(u: { id: string; lessons: { id: string }[] }): DomainUnit {
  return {
    id: u.id,
    order: 0,
    title: "",
    description: "",
    type: "kana",
    grammarNotes: [],
    vocab: [],
    sentences: [],
    lessons: u.lessons.map((l) => ({ id: l.id, title: "", exercises: [] })),
  };
}

/** Gerbang baca konten: satu-satunya tempat yang merekonstruksi Unit/Lesson
 * bentuk packages/domain dari baris Prisma, supaya LearningPathModule dan
 * LessonsModule bisa reuse ExerciseFactory/LessonSession/unlockRules yang
 * SAMA persis dengan yang dipakai frontend (lihat plan bagian "Keputusan
 * Lintas-Sektor": grading server-authoritative pakai fungsi domain yang sama). */
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async loadUnit(unitId: string): Promise<DomainUnit> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId }, include: UNIT_CONTENT_INCLUDE });
    if (!unit) throw new NotFoundException(`Unit tidak ditemukan: ${unitId}`);

    const audioUrlByHash = await loadAudioUrlsByHash(this.prisma, audioHashKeysForUnit(unit));
    return toDomainUnit(unit, audioUrlByHash);
  }

  /** Dipakai LessonsModule: GET/POST /lessons/:id cuma tahu lessonId, bukan
   * unitId induknya. Unit lengkap tetap dimuat (bukan cuma lesson-nya) --
   * ExerciseFactory butuh unit.vocab/unit.sentences penuh untuk memilih
   * distractor (lihat exerciseFactory.ts). */
  async loadLessonWithUnit(lessonId: string): Promise<{ unit: DomainUnit; lesson: DomainLesson }> {
    const lessonRow = await this.prisma.lesson.findUnique({ where: { id: lessonId }, select: { unitId: true } });
    if (!lessonRow) throw new NotFoundException(`Lesson tidak ditemukan: ${lessonId}`);

    const unit = await this.loadUnit(lessonRow.unitId);
    const lesson = unit.lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new NotFoundException(`Lesson ${lessonId} tidak ditemukan di unit ${lessonRow.unitId}`);
    return { unit, lesson };
  }

  /** Ditegakkan di server (bukan cuma client) -- lihat "Keputusan
   * Lintas-Sektor" di plan. Melempar ForbiddenException kalau lesson ini
   * masih terkunci untuk user tsb; sengaja pakai deriveNodeStates yang SAMA
   * dengan yang dipakai LearningPathService untuk GET /path, supaya status
   * "terkunci" di peta dan penegakan di POST /attempts tidak pernah
   * berbeda. Unit/lesson yang SUDAH selesai tetap dianggap tidak terkunci
   * (boleh diulang) -- deriveNodeStates mengembalikan 'done', bukan 'locked',
   * untuk itu. */
  async assertLessonUnlocked(userId: string, unitId: string, lessonId: string): Promise<void> {
    const units = await this.prisma.unit.findMany({
      orderBy: [{ level: { order: "asc" } }, { order: "asc" }],
      select: { id: true, lessons: { orderBy: { order: "asc" }, select: { id: true } } },
    });
    const flatUnits = units.map(toMinimalDomainUnit);
    const unitIndex = flatUnits.findIndex((u) => u.id === unitId);
    if (unitIndex === -1) throw new NotFoundException(`Unit tidak ditemukan: ${unitId}`);

    const unit = flatUnits[unitIndex]!;
    const lessonIndex = unit.lessons.findIndex((l) => l.id === lessonId);
    if (lessonIndex === -1) throw new NotFoundException(`Lesson ${lessonId} tidak ditemukan di unit ${unitId}`);

    const completedLessonRows = await this.prisma.userLessonProgress.findMany({
      where: { userId, completedAt: { not: null } },
      select: { lessonId: true },
    });
    const completedLessonIds = new Set(completedLessonRows.map((p) => p.lessonId));
    const completedLessonKeys = new Set<string>();
    for (const u of flatUnits) {
      for (const l of u.lessons) {
        if (completedLessonIds.has(l.id)) completedLessonKeys.add(UnlockRules.lessonKey(u, l));
      }
    }

    const unitUnlocked = UnlockRules.isUnitUnlocked(flatUnits, unitIndex, completedLessonKeys);
    const state = deriveNodeStates(unit, unitUnlocked, completedLessonKeys)[lessonIndex]!;
    if (state === "locked") {
      throw new ForbiddenException(`Lesson ${lessonId} masih terkunci -- selesaikan lesson sebelumnya dulu`);
    }
  }
}
