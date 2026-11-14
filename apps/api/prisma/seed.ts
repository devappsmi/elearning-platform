/** Migrasi konten kurikulum -- Milestone 6 di plan fondasi (docs/PLAN.md
 * bagian "5. Migrasi Konten Hiragana"), kini untuk SEMUA unit di daftar
 * src/content-import/unit-manifest.ts: Hiragana (prisma/seed-data/raw/unit_hiragana.json,
 * salinan packages/domain/src/content/__fixtures__/unit_hiragana.json) dan unit-unit yang
 * ditulis pengajar di Word lalu diimpor (`pnpm run unit:import`, docs/DEPLOY.md bagian 5b).
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
  BadgeService,
  scenarioContentSchema,
  type Exercise as DomainExercise,
  type Unit as DomainUnit,
} from "@elearning/domain";
import { AudioService } from "../src/audio/audio.service";
import { createAudioStorage } from "../src/audio/audio-storage";
import { lessonAudioItemsForUnits, seedLessonAudio } from "../src/audio/lesson-audio-seed";
import { resolveStorageOptions } from "../src/audio/storage-options";
import { createTtsClient } from "../src/audio/tts-factory";
import { describeTtsOptions, resolveTtsOptions, ttsUnavailableReason, type TtsOptions } from "../src/audio/tts-options";
import { seedDataPath, UNIT_MANIFEST, type UnitManifestEntry } from "../src/content-import/unit-manifest";

const prisma = new PrismaClient();

function loadUnit(entry: UnitManifestEntry): DomainUnit {
  const raw = readFileSync(seedDataPath(entry.file), "utf-8");
  const json: unknown = JSON.parse(raw);
  return unitSchema.parse(json);
}

function toPrismaExerciseType(type: DomainExercise["type"]): "CHOOSE" | "ASSEMBLE" | null {
  if (type === "choose") return "CHOOSE";
  if (type === "assemble") return "ASSEMBLE";
  return null; // 'speak' -- tidak dimigrasikan, lihat komentar berkas ini
}

async function seedUnit(unit: DomainUnit, levelDef: UnitManifestEntry["level"]): Promise<void> {
  const level = await prisma.level.upsert({
    where: { code: levelDef.code },
    update: { name: levelDef.name, order: levelDef.order },
    create: { code: levelDef.code, name: levelDef.name, order: levelDef.order },
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

  // Kalimat yang tak ada lagi di JSON (mis. unit diimpor ulang dari Word yang sudah direvisi, id kalimat berbasis posisi) dihapus:
  // tak ada tabel lain yang menunjuknya (soal merujuk lewat payload, bukan FK), dan kalau tertinggal ia terus jadi bahan pengecoh.
  await prisma.sentence.deleteMany({ where: { unitId: unit.id, id: { notIn: unit.sentences.map((s) => s.id) } } });

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
 * audio.service.ts). Penyedia TTS dipilih lewat TTS_PROVIDER (lihat
 * src/audio/tts-options.ts): Azure atau OpenAI. Best-effort dan gagal-aman:
 * kalau belum ada kredensial TTS (mis. environment dev/sandbox), seed TETAP
 * jalan seperti biasa -- cuma audio yang tidak tersedia (placeholder "" di
 * ContentService, lihat content.mapper.ts), bukan seluruh migrasi konten
 * gagal karena satu kredensial belum ada. Berhenti di kegagalan PERTAMA
 * (lihat seedLessonAudio). SEED_AUDIO_REGENERATE=1: buat ulang SEMUA audio
 * pelajaran walau sudah ada (ganti suara/penyedia). Mengembalikan ringkasan
 * status untuk baris "Seed selesai". */
async function seedAudioAssets(units: readonly DomainUnit[], ttsOptions: TtsOptions): Promise<string> {
  const tts = createTtsClient(ttsOptions);
  if (!tts.configured) {
    const reason = ttsUnavailableReason(ttsOptions) ?? "penyedia TTS belum siap";
    console.warn(
      ttsOptions.provider === "none" && ttsOptions.reason === "disabled"
        ? `Seed audio DILEWATI: ${reason}.`
        : `Seed audio DILEWATI: ${reason}. Isi OPENAI_API_KEY (bisa kunci yang sama dengan AI tutor) ATAU AZURE_SPEECH_KEY + ` +
            "AZURE_SPEECH_REGION di .env, lalu jalankan ulang db:seed -- pelajaran tetap berjalan, hanya tanpa audio " +
            "(lihat docs/DEPLOY.md, bagian 6a).",
    );
    return "dilewati";
  }

  // Penyimpanan yang SAMA dengan API (env yang sama): audio yang dibuat seed langsung bisa disajikan API.
  const storage = createAudioStorage(resolveStorageOptions(process.env));
  const audio = new AudioService(prisma, tts, storage);
  const refresh = /^(1|true|yes)$/i.test(process.env.SEED_AUDIO_REGENERATE?.trim() ?? "");
  const items = lessonAudioItemsForUnits(units);

  console.log(
    `Seed audio: ${items.length} teks, penyedia ${describeTtsOptions(ttsOptions)}` +
      `${refresh ? " -- MEMBUAT ULANG semua audio (SEED_AUDIO_REGENERATE)" : ""}. Memanggil TTS satu per satu; bisa beberapa menit.`,
  );
  const result = await seedLessonAudio(audio, items, {
    refresh,
    onProgress: (ready, total) => {
      if (ready % 20 === 0 && ready < total) console.log(`  audio ${ready}/${total}`);
    },
  });

  if (result.failure) {
    console.warn(
      `Seed audio berhenti di '${result.failure.text}' (${result.ready}/${result.total} berhasil sebelumnya): ${result.failure.message}`,
    );
    return `sebagian ${result.ready}/${result.total}`;
  }
  console.log(
    refresh
      ? `Seed audio selesai: ${result.ready}/${result.total} teks dibuat ulang.`
      : `Seed audio selesai: ${result.ready}/${result.total} teks (cache hit tidak memanggil TTS ulang).`,
  );
  return `lengkap ${result.ready}/${result.total}`;
}

async function seedBadges(units: readonly DomainUnit[]): Promise<void> {
  // BadgeCatalog.all(units) menambah satu badge dinamis ("Tuntas: <judul unit>") per unit bertipe conversation -- unit kana
  // (Hiragana) tidak menghasilkan badge tambahan, persis seperti BadgeService.evaluate memperlakukannya.
  const unitByBadgeCode = new Map(units.map((u) => [BadgeService.unitBadge(u.id), u.id]));
  for (const badge of BadgeCatalog.all([...units])) {
    const unitId = unitByBadgeCode.get(badge.id);
    const data = { nameId: badge.title, criteria: { description: badge.description } as unknown as Prisma.InputJsonValue, unitId: unitId ?? null };
    await prisma.badge.upsert({ where: { code: badge.id }, update: data, create: { code: badge.id, ...data } });
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
  // Nama penyedia TTS yang salah = galat konfigurasi: gagal SEKARANG dengan satu baris yang jelas, sebelum menyentuh
  // database (bukan setengah jalan dan bukan tumpukan jejak).
  let ttsOptions: TtsOptions;
  try {
    ttsOptions = resolveTtsOptions(process.env);
  } catch (error) {
    console.error(`GAGAL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }
  const entries = UNIT_MANIFEST.map((entry) => ({ entry, unit: loadUnit(entry) }));
  for (const { entry, unit } of entries) await seedUnit(unit, entry.level);
  const units = entries.map(({ unit }) => unit);
  await seedBadges(units);
  const audioStatus = await seedAudioAssets(units, ttsOptions);
  await seedExampleScenario();

  for (const unit of units) {
    const [vocabCount, sentenceCount, lessonCount, exerciseCount] = await Promise.all([
      prisma.vocab.count({ where: { unitId: unit.id } }),
      prisma.sentence.count({ where: { unitId: unit.id } }),
      prisma.lesson.count({ where: { unitId: unit.id } }),
      prisma.exercise.count({ where: { lesson: { unitId: unit.id } } }),
    ]);
    console.log(`Unit ${unit.id}: vocab=${vocabCount} sentence=${sentenceCount} lesson=${lessonCount} exercise=${exerciseCount}`);
  }
  const [badgeCount, scenarioCount] = await Promise.all([prisma.badge.count(), prisma.scenario.count()]);
  console.log(`Seed selesai: unit=${units.length} badge=${badgeCount} scenario=${scenarioCount} audio=${audioStatus}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
