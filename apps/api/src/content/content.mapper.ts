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
import { hashAudioKey } from "../audio/audio-hash.util";
import type { AudioUrlByHash } from "../audio/audio-lookup.util";

// Vocab TIDAK punya field voice di skema (beda dari Sentence) -- selalu
// 'female', konsisten dengan default voice Sentence lama saat field itu
// kosong (lihat packages/domain/content/types.ts).

/** Shape Prisma yang cukup untuk direkonstruksi jadi domain Unit lengkap --
 * dipakai bersama oleh ContentService (baca) dan seed.ts (tulis, arah
 * sebaliknya) supaya mapping field Prisma<->domain cuma didefinisikan sekali. */
export const UNIT_CONTENT_INCLUDE = {
  vocab: true,
  sentences: true,
  lessons: { include: { exercises: true }, orderBy: { order: "asc" } },
} as const;

export type UnitWithContent = Prisma.UnitGetPayload<{ include: typeof UNIT_CONTENT_INCLUDE }>;

function toDomainVocab(v: UnitWithContent["vocab"][number], audioUrlByHash: AudioUrlByHash): DomainVocab {
  return {
    id: v.id,
    surface: v.jp,
    kana: v.reading,
    romaji: v.romaji,
    // "" kalau AudioAsset-nya belum pernah digenerate (mis. AZURE_SPEECH_KEY
    // belum dikonfigurasi -- lihat seed.ts) -- placeholder JUJUR, bukan url
    // palsu. ExerciseFactory/LessonSession sendiri tidak pernah membaca field
    // ini, cuma dibutuhkan tipe Vocab domain; audio murni untuk diputar di UI.
    audio: audioUrlByHash.get(hashAudioKey(v.jp, "female")) ?? "",
    meaning: v.meaningId ?? undefined,
    image: undefined,
  };
}

function toDomainSentence(s: UnitWithContent["sentences"][number], audioUrlByHash: AudioUrlByHash): DomainSentence {
  const voice = s.voice === "male" ? "male" : "female";
  return {
    id: s.id,
    surface: s.surface,
    kana: s.kana,
    romaji: s.romaji,
    meaning: s.meaning,
    words: s.words as unknown as WordPart[],
    assembleTokens: (s.assembleTokens as unknown as string[] | null) ?? undefined,
    audio: audioUrlByHash.get(hashAudioKey(s.surface, voice)) ?? "", // lihat catatan toDomainVocab
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

/** Semua kunci hash AudioAsset yang dibutuhkan untuk merender satu unit --
 * ContentService query bulk pakai daftar ini SEBELUM memanggil toDomainUnit,
 * supaya toDomainUnit tetap murni/sync (tidak akses Prisma sendiri). */
export function audioHashKeysForUnit(u: UnitWithContent): string[] {
  const vocabKeys = u.vocab.map((v) => hashAudioKey(v.jp, "female"));
  const sentenceKeys = u.sentences.map((s) => hashAudioKey(s.surface, s.voice === "male" ? "male" : "female"));
  return [...vocabKeys, ...sentenceKeys];
}

export function toDomainUnit(u: UnitWithContent, audioUrlByHash: AudioUrlByHash): DomainUnit {
  return {
    id: u.id,
    order: u.order,
    title: u.title,
    description: u.description,
    type: u.type === "CONVERSATION" ? "conversation" : "kana",
    grammarNotes: u.grammarNotes as unknown as GrammarNote[],
    vocab: u.vocab.map((v) => toDomainVocab(v, audioUrlByHash)),
    sentences: u.sentences.map((s) => toDomainSentence(s, audioUrlByHash)),
    lessons: u.lessons.map(toDomainLesson),
  };
}
