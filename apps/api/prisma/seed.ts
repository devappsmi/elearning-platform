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
import {
  unitSchema,
  BadgeCatalog,
  scenarioContentSchema,
  type Exercise as DomainExercise,
  type Unit as DomainUnit,
} from "@elearning/domain";
import { AudioService } from "../src/audio/audio.service";
import { AzureTtsClient } from "../src/audio/azure-tts.client";
import { ObjectStorageService } from "../src/audio/object-storage.service";

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

/** Milestone 8: pre-generate audio SAAT SEED (bukan on-demand saat
 * `GET /lessons/:id` -- lihat catatan NFR "API p95 < 300ms" di
 * audio.service.ts). Best-effort dan gagal-aman: kalau AZURE_SPEECH_KEY/
 * REGION belum diisi (mis. environment dev/sandbox tanpa kredensial), seed
 * TETAP jalan seperti biasa -- cuma audio yang tidak tersedia (placeholder
 * "" di ContentService, lihat content.mapper.ts), bukan seluruh migrasi
 * konten gagal karena satu kredensial belum ada. Berhenti di kegagalan
 * PERTAMA (bukan retry semua item) -- kegagalan TTS/S3 di sini nyaris
 * selalu sistemik (kredensial salah/storage tidak terjangkau), mengulang
 * 160 kali untuk error yang sama cuma nge-spam log, bukan menolong. */
async function seedAudioAssets(unit: DomainUnit): Promise<void> {
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    console.warn(
      "Seed audio DILEWATI: AZURE_SPEECH_KEY/AZURE_SPEECH_REGION belum diisi di .env -- " +
        "audio lesson akan kosong sampai kredensial TTS tersedia (lihat docs/PLAN.md, Milestone 8).",
    );
    return;
  }

  const tts = new AzureTtsClient(
    process.env.AZURE_SPEECH_KEY,
    process.env.AZURE_SPEECH_REGION,
    process.env.AZURE_TTS_VOICE_FEMALE ?? "ja-JP-NanamiNeural",
    process.env.AZURE_TTS_VOICE_MALE ?? "ja-JP-KeitaNeural",
  );
  const storage = new ObjectStorageService(
    process.env.S3_ENDPOINT ?? "",
    process.env.S3_REGION ?? "",
    process.env.S3_BUCKET ?? "",
    process.env.S3_ACCESS_KEY_ID ?? "",
    process.env.S3_SECRET_ACCESS_KEY ?? "",
  );
  const audio = new AudioService(prisma, tts, storage);

  const items: { text: string; voice: "female" | "male" }[] = [
    ...unit.vocab.map((v) => ({ text: v.surface, voice: "female" as const })),
    ...unit.sentences.map((s) => ({ text: s.surface, voice: s.voice === "male" ? ("male" as const) : ("female" as const) })),
  ];

  let generated = 0;
  for (const item of items) {
    try {
      await audio.resolveAudioUrl(item.text, item.voice);
      generated++;
    } catch (err) {
      console.warn(
        `Seed audio berhenti di '${item.text}' (${generated}/${items.length} berhasil sebelumnya): ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
  }
  console.log(`Seed audio selesai: ${generated}/${items.length} teks (cache hit tidak memanggil TTS ulang).`);
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

// Kosakata yang dirujuk scenario.vocab -- di luar cakupan Hiragana (bukan
// kana, kata benda/salam N5), jadi diseed di sini, bukan seedHiraganaUnit.
// unitId sengaja null: entri kamus lepas (lihat DictionaryModule), bukan
// milik lesson unit mana pun.
const SCENARIO_VOCAB: { id: string; jp: string; reading: string; romaji: string; meaningId: string }[] = [
  { id: "voc_hajimemashite", jp: "はじめまして", reading: "はじめまして", romaji: "hajimemashite", meaningId: "salam kenal (dipakai sekali saat pertama kali bertemu)" },
  { id: "voc_onamae", jp: "お名前", reading: "おなまえ", romaji: "onamae", meaningId: "nama (bentuk sopan)" },
  { id: "voc_yoroshiku", jp: "よろしく", reading: "よろしく", romaji: "yoroshiku", meaningId: "mohon bantuannya / senang berkenalan" },
];

/** Milestone 9 (ScenariosModule): SATU contoh skenario ("Perkenalan Diri",
 * skenario pertama di daftar CONV-01 PRD) untuk membuktikan pipeline
 * end-to-end -- BUKAN 10 skenario MVP penuh. Authoring 10 dialog JLPT N5
 * akurat adalah kerja konten tersendiri (PRD §12 eksplisit menandai "beban
 * pembuatan konten" sebagai risiko, mitigasinya "libatkan pengajar lembaga
 * pilot" -- bukan sesuatu yang pantas ditulis sendiri di sini asal-asalan),
 * sama seperti kurikulum Katakana/Dasar/N5/N4 di luar Hiragana. */
async function seedExampleScenario(): Promise<void> {
  const raw = JSON.parse(readFileSync(join(__dirname, "seed-data/raw/scenario-perkenalan.json"), "utf-8"));
  const parsed = scenarioContentSchema.parse(raw); // validasi saja -- yang DISIMPAN tetap `raw` (snake_case asli, sama seperti dibaca ulang ScenariosService)

  for (const v of SCENARIO_VOCAB) {
    await prisma.vocab.upsert({ where: { id: v.id }, update: v, create: v });
  }

  await prisma.scenario.upsert({
    where: { id: parsed.scenarioId },
    update: { titleJp: parsed.titleJp, titleId: parsed.titleId, level: "N5", payload: raw as unknown as Prisma.InputJsonValue, status: "PUBLISHED" },
    create: {
      id: parsed.scenarioId,
      titleJp: parsed.titleJp,
      titleId: parsed.titleId,
      level: "N5",
      payload: raw as unknown as Prisma.InputJsonValue,
      status: "PUBLISHED",
    },
  });
}

async function main(): Promise<void> {
  const unit = loadHiraganaUnit();
  await seedHiraganaUnit(unit);
  await seedStaticBadges();
  await seedAudioAssets(unit);
  await seedExampleScenario();

  const [vocabCount, sentenceCount, lessonCount, exerciseCount, badgeCount, scenarioCount] = await Promise.all([
    prisma.vocab.count({ where: { unitId: unit.id } }),
    prisma.sentence.count({ where: { unitId: unit.id } }),
    prisma.lesson.count({ where: { unitId: unit.id } }),
    prisma.exercise.count({ where: { lesson: { unitId: unit.id } } }),
    prisma.badge.count(),
    prisma.scenario.count(),
  ]);
  console.log(
    `Seed selesai: unit=${unit.id} vocab=${vocabCount} sentence=${sentenceCount} lesson=${lessonCount} exercise=${exerciseCount} badge=${badgeCount} scenario=${scenarioCount}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
