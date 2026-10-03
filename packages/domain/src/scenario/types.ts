import { z } from 'zod';
import { grammarNoteSchema, type GrammarNote } from '../content/types';

/** Skema + tipe konten skenario percakapan (CONV-01/02, PRD §6.4). BEDA dari
 * content/types.ts: itu port dari app lama (webapp/src/domain/content), ini
 * BARU SAMA SEKALI -- tidak ada padanan di app lama, PRD juga cuma kasih
 * SATU contoh JSON (CONV-02) dengan `"vocab": [...], "grammar_notes": [...]`
 * literal elipsis, jadi shape keduanya di sini adalah interpretasi, bukan
 * spek pasti. `grammar_notes` reuse skema `GrammarNote` yang SAMA dengan
 * konten lesson (nama field identik di PRD, masuk akal dianggap sama).
 * `vocab` diasumsikan daftar ID yang menunjuk ke tabel `Vocab` (BUKAN data
 * inline) -- supaya "bisa ditambah ke flashcard" (CONV-05) punya makna
 * konkret: itu literal `Vocab.id` yang sudah bisa langsung dipakai
 * FlashcardsModule/SrsService, bukan struct terpisah yang perlu dipetakan
 * dulu. `estimated_minutes` DITAMBAHKAN (tidak ada di contoh JSON PRD) --
 * CONV-01 eksplisit minta "estimasi durasi" ditampilkan di katalog, harus
 * datang dari suatu tempat. */

// `audio` TIDAK ADA di JSON sumber (CONV-02 eksplisit: audio di-resolve dari
// hash teks JP saat runtime, bukan field manual -- PRD §9.4). Sama seperti
// Vocab/Sentence di content/types.ts: parse zod isi "" (placeholder jujur),
// ContentService-equivalent (ScenariosService) yang mengisi URL sungguhan
// lewat lookup AudioAsset SETELAH parse -- lihat scenarios.service.ts.

export const dialogueOptionSchema = z
  .object({
    jp: z.string(),
    correct: z.boolean(),
    feedback_id: z.string().nullish(),
  })
  .transform(
    (o): DialogueOption => ({ jp: o.jp, correct: o.correct, feedbackId: o.feedback_id ?? undefined, audio: '' }),
  );
export interface DialogueOption {
  jp: string;
  correct: boolean;
  feedbackId?: string;
  audio: string;
}

const narrationLineSchema = z
  .object({
    speaker: z.string(),
    jp: z.string(),
    romaji: z.string(),
    // Field literal "id" di CONV-02 (terjemahan Bahasa Indonesia baris ini) --
    // ditransformasi ke `meaning` di sini, meniru pola meaning_id->meaning di
    // content/types.ts, supaya tidak rancu dengan `scenario_id`/id entitas lain.
    id: z.string(),
  })
  .transform(
    (l): NarrationLine => ({ kind: 'narration', speaker: l.speaker, jp: l.jp, romaji: l.romaji, meaning: l.id, audio: '' }),
  );
export interface NarrationLine {
  kind: 'narration';
  speaker: string;
  jp: string;
  romaji: string;
  meaning: string;
  audio: string;
}

const choiceLineSchema = z
  .object({
    speaker: z.string(),
    type: z.literal('choice'),
    options: z.array(dialogueOptionSchema),
  })
  .transform((l): ChoiceLine => ({ kind: 'choice', speaker: l.speaker, options: l.options }));
export interface ChoiceLine {
  kind: 'choice';
  speaker: string;
  options: DialogueOption[];
}

export type ScenarioLine = NarrationLine | ChoiceLine;
// Baris narasi TIDAK punya field `type` sama sekali di CONV-02 (implisit) --
// z.union (bukan z.discriminatedUnion, yang mewajibkan diskriminator hadir
// di SEMUA anggota) mencoba tiap skema; dua bentuk ini saling eksklusif
// (choice wajib `type`+`options`, narration wajib `jp`+`romaji`+`id`) jadi
// tidak ambigu.
export const scenarioLineSchema = z.union([choiceLineSchema, narrationLineSchema]);

export const scenarioContentSchema = z
  .object({
    scenario_id: z.string(),
    title: z.object({ id: z.string(), jp: z.string() }),
    level: z.string(),
    roles: z.array(z.string()),
    estimated_minutes: z.number().positive(),
    lines: z.array(scenarioLineSchema),
    vocab: z.array(z.string()).nullish(),
    grammar_notes: z.array(grammarNoteSchema).nullish(),
  })
  .transform(
    (s): ScenarioContent => ({
      scenarioId: s.scenario_id,
      titleId: s.title.id,
      titleJp: s.title.jp,
      level: s.level,
      roles: s.roles,
      estimatedMinutes: s.estimated_minutes,
      lines: s.lines,
      vocab: s.vocab ?? [],
      grammarNotes: s.grammar_notes ?? [],
    }),
  );

export interface ScenarioContent {
  scenarioId: string;
  titleId: string;
  titleJp: string;
  level: string;
  roles: string[];
  estimatedMinutes: number;
  lines: ScenarioLine[];
  vocab: string[];
  grammarNotes: GrammarNote[];
}
