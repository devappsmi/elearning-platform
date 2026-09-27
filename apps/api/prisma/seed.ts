/** Migrasi konten Hiragana -- Milestone 6 di plan fondasi (docs/PLAN.md
 * bagian "5. Migrasi Konten Hiragana"). Sumber: prisma/seed-data/raw/unit_hiragana.json
 * (salinan packages/domain/src/content/__fixtures__/unit_hiragana.json).
 *
 * Skema zod packages/domain (unitSchema) jadi GERBANG VALIDASI sebelum data
 * lama di-upsert -- kalau bentuk JSON berubah/rusak, seed gagal di sini
 * dengan pesan jelas, bukan upsert data setengah-valid ke Postgres.
 *
 * Idempotent by natural key: Level by `code`, Unit/Vocab/Sentence/Lesson by
 * `id` (dipertahankan sama persis dengan id di JSON sumber, BUKAN cuid baru
 * -- supaya Exercise.payload.ref yang menunjuk ke id ini tetap valid lintas
 * re-run). Exercise dihapus+ditulis ulang per lesson tiap re-run (bukan
 * upsert per baris) -- lebih sederhana & tetap aman karena tidak ada FK lain
 * yang menunjuk ke baris Exercise individual (lihat schema.prisma).
 *
 * Tipe exercise `speak` SENGAJA TIDAK dimigrasikan sebagai Exercise (lihat
 * packages/domain/src/exercises/preparedExercise.ts) -- kata/kalimat yang
 * dirujuknya tetap masuk sebagai Vocab/Sentence lewat unit.vocab/unit.sentences
 * (dipakai bersama oleh exercise choose/assemble lain), cuma baris Exercise-nya
 * sendiri yang di-skip.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { unitSchema, BadgeCatalog, type Exercise as DomainExercise, type Unit as DomainUnit } from "@elearning/domain";

const prisma = new PrismaClient();

function loadHiraganaUnit(): DomainUnit {
  const raw = readFileSync(join(__dirname, "seed-data/raw/unit_hiragana.json"), "utf-8");
  const json: unknown = JSON.parse(raw);
  return unitSchema.parse(json);
}

function toPrismaExerciseType(type: DomainExercise["type"]): "CHOOSE" | "ASSEMBLE" | null {
  if (type === "choose") return "CHOOSE";
  if (type === "assemble") return "ASSEMBLE";
  return null; // 'speak' -- tidak dimigrasikan, lihat komentar berkas ini
}

async function seedHiraganaUnit(unit: DomainUnit): Promise<void> {
  const level = await prisma.level.upsert({
    where: { code: "HIRAGANA" },
    update: { name: "Hiragana", order: 1 },
    create: { code: "HIRAGANA", name: "Hiragana", order: 1 },
  });

  await prisma.unit.upsert({
    where: { id: unit.id },
    update: {
      levelId: level.id,
      title: unit.title,
      order: unit.order,
      description: unit.description,
      type: unit.type === "conversation" ? "CONVERSATION" : "KANA",
      grammarNotes: unit.grammarNotes as unknown as Prisma.InputJsonValue,
    },
    create: {
      id: unit.id,
      levelId: level.id,
      title: unit.title,
      order: unit.order,
      description: unit.description,
      type: unit.type === "conversation" ? "CONVERSATION" : "KANA",
      grammarNotes: unit.grammarNotes as unknown as Prisma.InputJsonValue,
    },
  });

  for (const v of unit.vocab) {
    await prisma.vocab.upsert({
      where: { id: v.id },
      update: { unitId: unit.id, jp: v.surface, reading: v.kana, romaji: v.romaji, meaningId: v.meaning ?? null },
      create: { id: v.id, unitId: unit.id, jp: v.surface, reading: v.kana, romaji: v.romaji, meaningId: v.meaning ?? null },
    });
  }

  for (const s of unit.sentences) {
    await prisma.sentence.upsert({
      where: { id: s.id },
      update: {
        unitId: unit.id,
        surface: s.surface,
        kana: s.kana,
        romaji: s.romaji,
        meaning: s.meaning,
        words: s.words as unknown as Prisma.InputJsonValue,
        assembleTokens: (s.assembleTokens ?? null) as unknown as Prisma.InputJsonValue,
        voice: s.voice,
      },
      create: {
        id: s.id,
        unitId: unit.id,
        surface: s.surface,
        kana: s.kana,
        romaji: s.romaji,
        meaning: s.meaning,
        words: s.words as unknown as Prisma.InputJsonValue,
        assembleTokens: (s.assembleTokens ?? null) as unknown as Prisma.InputJsonValue,
        voice: s.voice,
      },
    });
  }

  for (const [lessonIndex, lesson] of unit.lessons.entries()) {
    await prisma.lesson.upsert({
      where: { id: lesson.id },
      update: { unitId: unit.id, title: lesson.title, order: lessonIndex },
      create: { id: lesson.id, unitId: unit.id, title: lesson.title, order: lessonIndex },
    });

    const migratable = lesson.exercises
      .map((e) => ({ e, type: toPrismaExerciseType(e.type) }))
      .filter((x): x is { e: DomainExercise; type: "CHOOSE" | "ASSEMBLE" } => x.type !== null);

    await prisma.exercise.deleteMany({ where: { lessonId: lesson.id } });
    await prisma.exercise.createMany({
      data: migratable.map(({ e, type }, order) => ({
        id: `${lesson.id}_${order}`,
        lessonId: lesson.id,
        type,
        order,
        payload: (e.variant ? { ref: e.ref, variant: e.variant } : { ref: e.ref }) as unknown as Prisma.InputJsonValue,
      })),
    });
  }
}

async function seedStaticBadges(): Promise<void> {
  // BadgeCatalog.all(units) juga menambah badge dinamis per-unit conversation
  // -- unit_hiragana bertipe 'kana', jadi tidak menghasilkan badge tambahan
  // di sini (persis seperti BadgeService.evaluate akan memperlakukannya nanti).
  for (const badge of BadgeCatalog.all([])) {
    await prisma.badge.upsert({
      where: { code: badge.id },
      update: { nameId: badge.title, criteria: { description: badge.description } as unknown as Prisma.InputJsonValue },
      create: { code: badge.id, nameId: badge.title, criteria: { description: badge.description } as unknown as Prisma.InputJsonValue },
    });
  }
}

async function main(): Promise<void> {
  const unit = loadHiraganaUnit();
  await seedHiraganaUnit(unit);
  await seedStaticBadges();

  const [vocabCount, sentenceCount, lessonCount, exerciseCount, badgeCount] = await Promise.all([
    prisma.vocab.count({ where: { unitId: unit.id } }),
    prisma.sentence.count({ where: { unitId: unit.id } }),
    prisma.lesson.count({ where: { unitId: unit.id } }),
    prisma.exercise.count({ where: { lesson: { unitId: unit.id } } }),
    prisma.badge.count(),
  ]);
  console.log(
    `Seed selesai: unit=${unit.id} vocab=${vocabCount} sentence=${sentenceCount} lesson=${lessonCount} exercise=${exerciseCount} badge=${badgeCount}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
