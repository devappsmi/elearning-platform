import { readFileSync } from "node:fs";
import { ExerciseFactory, unitSchema, type Unit } from "@elearning/domain";
import { describe, expect, test } from "vitest";
import { generateUnit, isImportable } from "./unit-import";
import { seedDataPath, UNIT_MANIFEST } from "./unit-manifest";

/** Tes isi SEMUA unit di manifest (yang dibaca `prisma/seed.ts`): bentuk, kelengkapan acuan, dan id yang tak bentrok -- supaya
 * kesalahan konten ketahuan di CI, bukan saat murid membuka pelajaran atau saat seed gagal di tengah jalan. */

const loaded = UNIT_MANIFEST.map((entry) => {
  const raw: unknown = JSON.parse(readFileSync(seedDataPath(entry.file), "utf-8"));
  return { entry, unit: unitSchema.parse(raw) as Unit };
});

describe("manifest unit", () => {
  test("id unit unik; nomor unit unik di dalam satu level; satu kode level = satu nama dan urutan", () => {
    const ids = loaded.map(({ unit }) => unit.id);
    expect(new Set(ids).size).toBe(ids.length);

    const unitNumbers = loaded.map(({ entry, unit }) => `${entry.level.code}#${unit.order}`);
    expect(new Set(unitNumbers).size).toBe(unitNumbers.length);

    const levels = new Map<string, string>();
    for (const { entry } of loaded) {
      const signature = `${entry.level.name}|${entry.level.order}`;
      expect(levels.get(entry.level.code) ?? signature).toBe(signature);
      levels.set(entry.level.code, signature);
    }
    const levelOrders = [...new Set(loaded.map(({ entry }) => `${entry.level.code}:${entry.level.order}`))].map((s) => s.split(":")[1]);
    expect(new Set(levelOrders).size).toBe(levelOrders.length);
  });

  test("id kosakata, kalimat, pelajaran, dan catatan unik di SELURUH unit (kunci utama tabel dipakai bersama)", () => {
    for (const key of ["vocab", "sentences", "lessons", "grammarNotes"] as const) {
      const ids = loaded.flatMap(({ unit }) => unit[key].map((item) => item.id));
      expect(new Set(ids).size, `id ${key} ganda`).toBe(ids.length);
    }
  });
});

describe.each(loaded)("isi unit $unit.id", ({ unit }) => {
  const vocabIds = new Set(unit.vocab.map((v) => v.id));
  const sentenceById = new Map(unit.sentences.map((s) => [s.id, s]));
  const doable = unit.lessons.map((lesson) => ({ lesson, exercises: lesson.exercises.filter((e) => e.type !== "speak") }));

  test("tiap soal merujuk kosakata/kalimat yang ada; soal pilih-arti-kosakata punya arti; soal susun punya >= 2 potongan (unit percakapan: yang menyusun tulisan kalimatnya)", () => {
    for (const { lesson, exercises } of doable) {
      expect(exercises.length, `pelajaran ${lesson.id} kosong`).toBeGreaterThan(0);
      for (const exercise of exercises) {
        const where = `${lesson.id} -> ${exercise.type} ${exercise.ref}`;
        const sentence = sentenceById.get(exercise.ref);
        if (exercise.type === "assemble") {
          expect(sentence, where).toBeDefined();
          const tokens = sentence?.assembleTokens ?? sentence?.words.map((w) => w.surface) ?? [];
          expect(tokens.length, where).toBeGreaterThanOrEqual(2);
          // Unit percakapan menyusun TULISAN kalimatnya (potongan Jepang); unit kana menyusun bacaannya (あい untuk 愛).
          if (unit.type === "conversation") expect(tokens.join(""), where).toBe(sentence?.surface);
        } else {
          expect(sentence !== undefined || vocabIds.has(exercise.ref), where).toBe(true);
        }
      }
    }
  });

  test("ExerciseFactory bisa menyiapkan semua soal (beberapa acakan): pilihan berisi jawaban benar tanpa pilihan ganda, susunan benar menyusun kalimat", () => {
    for (const seed of [0, 0.37, 0.99]) {
      for (const { lesson, exercises } of doable) {
        const factory = new ExerciseFactory({ unit, lesson: { ...lesson, exercises }, rng: () => seed });
        for (const exercise of exercises) {
          const prepared = factory.prepare(exercise);
          if (prepared.kind === "choose") {
            const texts = prepared.options.map((o) => o.text);
            expect(new Set(texts).size, `${lesson.id} ${exercise.ref}: pilihan ganda`).toBe(texts.length);
            expect(prepared.options[prepared.correctIndex]).toBeDefined();
          } else {
            expect(prepared.bank.length).toBeGreaterThanOrEqual(prepared.correct.length);
            expect([...prepared.correct].every((token) => prepared.bank.includes(token))).toBe(true);
          }
        }
      }
    }
  });

  test("catatan yang menunjuk pelajaran (lessonId) menunjuk pelajaran unit ini", () => {
    const lessonIds = new Set(unit.lessons.map((l) => l.id));
    for (const note of unit.grammarNotes) if (note.lessonId !== undefined) expect(lessonIds.has(note.lessonId), note.id).toBe(true);
  });
});

describe("unit yang dihasilkan dari template Word", () => {
  const importable = UNIT_MANIFEST.filter(isImportable);

  test("manifest memuat sedikitnya satu (Unit 3 Percakapan di Tempat Kerja)", () => {
    expect(importable.map((e) => e.source.unitId)).toContain("unit_kerja_3");
  });

  test.each(importable.map((entry) => [entry.source.unitId, entry] as const))(
    "%s: berkas JSON yang di-commit SAMA dengan hasil impor ulang sumber Word + overrides-nya (jalankan `pnpm --filter api run unit:import <unitId>` bila beda)",
    (_unitId, entry) => {
      const generated = generateUnit(entry);
      expect(readFileSync(seedDataPath(entry.file), "utf-8") === generated.json).toBe(true);
    },
  );

  test.each(importable.map((entry) => [entry.source.unitId, entry] as const))(
    "%s: tak ada peringatan impor yang belum ditinjau (yang diterima tercatat di overrides.acceptedWarnings beserta alasannya)",
    (_unitId, entry) => {
      const pending = generateUnit(entry).warnings.filter((warning) => !warning.accepted);
      expect(pending.map((w) => `${w.where}: ${w.message}`)).toEqual([]);
    },
  );

  test("Unit 3: 11 pola (satu pelajaran + satu catatan per pola), tipe conversation", () => {
    const unit = loaded.find(({ unit: u }) => u.id === "unit_kerja_3")?.unit;
    expect(unit?.type).toBe("conversation");
    expect(unit?.order).toBe(3);
    expect(unit?.lessons).toHaveLength(11);
    expect(unit?.grammarNotes.map((n) => n.lessonId)).toEqual(unit?.lessons.map((l) => l.id));
  });
});
