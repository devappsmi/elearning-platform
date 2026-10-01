import { z } from 'zod';

/** Skema + tipe konten, port dari lib/content/models/{unit,vocab,sentence}.dart.
 * JSON sumbernya snake_case (dibuat tools/gen_hiragana.py); skema di sini
 * mem-parse lalu mentransformasi ke bentuk camelCase yang dipakai di seluruh
 * app, persis seperti factory `fromJson` di versi Dart-nya.
 *
 * Tipe diekspor sebagai interface tulisan tangan (bukan `z.infer` dari hasil
 * `.transform()`) supaya field opsional benar-benar `?:` (boleh dihilangkan)
 * di seluruh app, bukan key wajib berisi `undefined` -- itu yang didapat
 * kalau tipe cuma diturunkan dari literal object yang dikembalikan
 * `.transform()`. Skema tetap divalidasi cocok lewat anotasi tipe balik
 * `.transform((x): TargetType => ...)`. */

export const unitTypeSchema = z.enum(['kana', 'conversation']);
export type UnitType = z.infer<typeof unitTypeSchema>;

export const exerciseTypeSchema = z.enum(['speak', 'choose', 'assemble']);
export type ExerciseType = z.infer<typeof exerciseTypeSchema>;

export interface WordPart {
  surface: string;
  kana: string;
}
export const wordPartSchema: z.ZodType<WordPart> = z.object({ surface: z.string(), kana: z.string() });

export interface Vocab {
  id: string;
  surface: string;
  kana: string;
  romaji: string;
  audio: string;
  meaning?: string;
  image?: string;
}

// Konten nyata (tools/gen_hiragana.py) punya field opsional yang eksplisit
// `null`, bukan cuma key yang hilang -- `.optional()` zod HANYA menerima
// `undefined`, bukan `null`, jadi field yang mungkin null harus `.nullish()`
// (menerima keduanya). Diverifikasi lewat parse ulang public/content/unit_hiragana.json
// sungguhan di types.test.ts, bukan diasumsikan dari baca kode Dart saja --
// vocab.meaning_id dan vocab.image ternyata `null` di semua 104 entri saat ini.
export const vocabSchema = z
  .object({
    id: z.string(),
    surface: z.string(),
    kana: z.string(),
    romaji: z.string(),
    audio: z.string(),
    meaning_id: z.string().nullish(),
    image: z.string().nullish(),
  })
  .transform(
    (v): Vocab => ({
      id: v.id,
      surface: v.surface,
      kana: v.kana,
      romaji: v.romaji,
      audio: v.audio,
      meaning: v.meaning_id ?? undefined,
      image: v.image ?? undefined,
    }),
  );

export interface Sentence {
  id: string;
  surface: string;
  kana: string;
  romaji: string;
  meaning: string;
  words: WordPart[];
  audio: string;
  assembleTokens?: string[];
  voice: string;
}

export const sentenceSchema = z
  .object({
    id: z.string(),
    surface: z.string(),
    kana: z.string(),
    romaji: z.string(),
    meaning_id: z.string(),
    words: z.array(wordPartSchema),
    audio: z.string(),
    assemble_tokens: z.array(z.string()).nullish(),
    voice: z.string().nullish(),
  })
  .transform(
    (s): Sentence => ({
      id: s.id,
      surface: s.surface,
      kana: s.kana,
      romaji: s.romaji,
      meaning: s.meaning_id,
      words: s.words,
      audio: s.audio,
      assembleTokens: s.assemble_tokens ?? undefined,
      voice: s.voice ?? 'female',
    }),
  );

export interface GrammarNote {
  id: string;
  title: string;
  bodyMd: string;
  /** Pelajaran (id) yang menampilkan catatan ini. Kosong = catatan milik unit secara umum (belum ditampilkan di pelajaran mana pun). */
  lessonId?: string;
}
export const grammarNoteSchema = z
  .object({ id: z.string(), title: z.string(), body_md: z.string(), lesson_id: z.string().nullish() })
  .transform((g): GrammarNote => ({ id: g.id, title: g.title, bodyMd: g.body_md, ...(g.lesson_id ? { lessonId: g.lesson_id } : {}) }));

export interface Exercise {
  type: ExerciseType;
  ref: string;
  variant?: string;
}
export const exerciseSchema = z
  .object({
    type: exerciseTypeSchema,
    ref: z.string(),
    variant: z.string().nullish(),
  })
  .transform((e): Exercise => ({ type: e.type, ref: e.ref, variant: e.variant ?? undefined }));

export interface Lesson {
  id: string;
  title: string;
  exercises: Exercise[];
}
export const lessonSchema: z.ZodType<Lesson> = z.object({
  id: z.string(),
  title: z.string(),
  exercises: z.array(exerciseSchema),
});

export interface Unit {
  id: string;
  order: number;
  title: string;
  description: string;
  type: UnitType;
  grammarNotes: GrammarNote[];
  vocab: Vocab[];
  sentences: Sentence[];
  lessons: Lesson[];
}

const unitBaseSchema = z.object({
  id: z.string(),
  order: z.number(),
  title: z.string(),
  description: z.string(),
  type: unitTypeSchema,
  // Dart: `json['grammar_notes'] as List<dynamic>? ?? const []` -- menangani
  // key hilang MAUPUN null. `.nullish()` + `?? []` di transform meniru itu
  // persis (`.default([])` zod cuma menangani key hilang, bukan null).
  grammar_notes: z.array(grammarNoteSchema).nullish(),
  vocab: z.array(vocabSchema),
  sentences: z.array(sentenceSchema),
  lessons: z.array(lessonSchema),
});

export const unitSchema = unitBaseSchema.transform(
  (u): Unit => ({
    id: u.id,
    order: u.order,
    title: u.title,
    description: u.description,
    type: u.type,
    grammarNotes: u.grammar_notes ?? [],
    vocab: u.vocab,
    sentences: u.sentences,
    lessons: u.lessons,
  }),
);

/** Setara Unit.vocabById/sentenceById Dart -- di sini fungsi murni, bukan
 * dibangun di constructor, supaya Unit tetap tipe data biasa. */
export function findVocabById(unit: Unit, id: string): Vocab | undefined {
  return unit.vocab.find((v) => v.id === id);
}

export function findSentenceById(unit: Unit, id: string): Sentence | undefined {
  return unit.sentences.find((s) => s.id === id);
}
