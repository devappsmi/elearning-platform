import type { Prisma, ExerciseType as PrismaExerciseType } from "@prisma/client";
import type {
  Exercise as DomainExercise,
  GrammarNote,
  Lesson as DomainLesson,
  Sentence as DomainSentence,
  Unit as DomainUnit,
  Vocab as DomainVocab,
  WordPart,
} from "@elearning/domain";

/** Shape Prisma yang cukup untuk direkonstruksi jadi domain Unit lengkap --
 * dipakai bersama oleh ContentService (baca) dan seed.ts (tulis, arah
 * sebaliknya) supaya mapping field Prisma<->domain cuma didefinisikan sekali. */
export const UNIT_CONTENT_INCLUDE = {
  vocab: true,
  sentences: true,
  lessons: { include: { exercises: true }, orderBy: { order: "asc" } },
} as const;

export type UnitWithContent = Prisma.UnitGetPayload<{ include: typeof UNIT_CONTENT_INCLUDE }>;

function toDomainVocab(v: UnitWithContent["vocab"][number]): DomainVocab {
  return {
    id: v.id,
    surface: v.jp,
    kana: v.reading,
    romaji: v.romaji,
    // AudioModule (Milestone 8) belum dibangun -- audio di-resolve runtime dari
    // hash teks JP (PRD §9.4), bukan lagi field tersimpan per-item seperti
    // konten lama. Placeholder kosong, BUKAN url asli -- jangan dipakai untuk
    // apa pun sebelum AudioModule ada (ExerciseFactory/LessonSession sendiri
    // tidak pernah membaca field ini, cuma dibutuhkan tipe Vocab domain).
    audio: "",
    meaning: v.meaningId ?? undefined,
    image: undefined,
  };
}

function toDomainSentence(s: UnitWithContent["sentences"][number]): DomainSentence {
  return {
    id: s.id,
    surface: s.surface,
    kana: s.kana,
    romaji: s.romaji,
    meaning: s.meaning,
    words: s.words as unknown as WordPart[],
    assembleTokens: (s.assembleTokens as unknown as string[] | null) ?? undefined,
    audio: "", // lihat catatan toDomainVocab
    voice: s.voice,
  };
}

function toDomainExerciseType(type: PrismaExerciseType): DomainExercise["type"] {
  if (type === "CHOOSE") return "choose";
  if (type === "ASSEMBLE") return "assemble";
  throw new Error(
    `Tipe exercise '${type}' belum didukung -- packages/domain (ExerciseFactory) cuma punya factory ` +
      `untuk choose/assemble. MATCHING/LISTENING/FILL_IN belum dibangun (lihat plan Milestone 7 & ` +
      `packages/domain/src/exercises/preparedExercise.ts).`,
  );
}

interface ExercisePayload {
  ref: string;
  variant?: string;
}

function readExercisePayload(raw: Prisma.JsonValue, exerciseId: string): ExercisePayload {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw) || typeof (raw as { ref?: unknown }).ref !== "string") {
    throw new Error(`Exercise ${exerciseId} punya payload tidak valid (butuh {ref: string}): ${JSON.stringify(raw)}`);
  }
  const variant = (raw as { variant?: unknown }).variant;
  return { ref: (raw as { ref: string }).ref, variant: typeof variant === "string" ? variant : undefined };
}

function toDomainExercise(e: UnitWithContent["lessons"][number]["exercises"][number]): DomainExercise {
  const payload = readExercisePayload(e.payload, e.id);
  return { type: toDomainExerciseType(e.type), ref: payload.ref, variant: payload.variant };
}

function toDomainLesson(l: UnitWithContent["lessons"][number]): DomainLesson {
  return { id: l.id, title: l.title, exercises: l.exercises.map(toDomainExercise) };
}

export function toDomainUnit(u: UnitWithContent): DomainUnit {
  return {
    id: u.id,
    order: u.order,
    title: u.title,
    description: u.description,
    type: u.type === "CONVERSATION" ? "conversation" : "kana",
    grammarNotes: u.grammarNotes as unknown as GrammarNote[],
    vocab: u.vocab.map(toDomainVocab),
    sentences: u.sentences.map(toDomainSentence),
    lessons: u.lessons.map(toDomainLesson),
  };
}
