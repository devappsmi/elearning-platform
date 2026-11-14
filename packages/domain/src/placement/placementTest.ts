import { findVocabById, type Exercise, type Lesson, type Sentence, type Unit } from '../content/types';
import { ExerciseFactory } from '../exercises/exerciseFactory';
import type { ChoiceOption } from '../exercises/preparedExercise';
import { nextInt, shuffled, type Rng } from '../shared/random';

/** Tes penempatan (PRD AUTH-05, opsional): 15 soal yang menentukan unit tempat murid mulai.
 *
 * Yang bisa dilewati hanyalah unit huruf (type 'kana') di AWAL jalur belajar -- PRD menyebut hasilnya
 * "Hiragana / Katakana / N5 unit awal". Tiap unit seperti itu menjadi satu SEKSI tes. Soalnya diambil dari isi unit
 * itu sendiri (latihan pilih huruf di pelajaran-pelajarannya + kata-kata yang diajarkannya), jadi penulis konten
 * tidak perlu menulis soal terpisah, dan unit huruf baru (mis. Katakana) otomatis ikut dites. Seksi lulus bila benar
 * >= 80% (ambang yang sama dengan lulus pelajaran, LP-03); murid mulai di unit seksi PERTAMA yang tidak lulus, atau di
 * unit sesudah seksi terakhir bila semuanya lulus. Unit terakhir di jalur tidak pernah bisa dilewati (harus ada tempat
 * untuk mulai). */

export const PLACEMENT_QUESTION_COUNT = 15;
export const PLACEMENT_PASS_PERCENT = 80;

/** Membaca huruf (kana -> romaji), memilih huruf untuk sebuah bunyi (romaji -> kana), atau arti kata berhuruf kana. */
export type PlacementQuestionKind = 'kana_to_romaji' | 'romaji_to_kana' | 'word_meaning';

export interface PlacementQuestion {
  sectionUnitId: string;
  kind: PlacementQuestionKind;
  /** Kosakata/kalimat sumber soal. */
  refId: string;
  prompt: string;
  promptSub?: string;
  options: ChoiceOption[];
  correctIndex: number;
}

export interface PlacementPlan {
  /** Unit yang bisa dilewati, urut jalur; satu seksi tes per unit. */
  sections: Unit[];
  /** Unit tempat murid mulai bila semua seksi lulus. */
  nextUnit: Unit;
}

/** Seksi tes untuk `units` (seluruh unit jalur belajar, urut): deretan unit huruf di awal jalur yang punya bahan soal,
 * tidak termasuk unit terakhir. `null` bila tidak ada yang bisa dilewati -- tes tidak ditawarkan. */
export function planPlacement(units: readonly Unit[]): PlacementPlan | null {
  const sections: Unit[] = [];
  for (const [index, unit] of units.entries()) {
    if (unit.type !== 'kana' || index === units.length - 1 || !hasQuestionMaterial(unit)) break;
    sections.push(unit);
  }
  const nextUnit = units[sections.length];
  return sections.length > 0 && nextUnit ? { sections, nextUnit } : null;
}

/** Soal tes, urut per seksi; di dalam seksi soal huruf mengikuti urutan pelajaran (makin sulit), lalu soal kata. */
export function buildPlacementTest(plan: PlacementPlan, rng: Rng = Math.random): PlacementQuestion[] {
  const quotas = splitEvenly(PLACEMENT_QUESTION_COUNT, plan.sections.length);
  return plan.sections.flatMap((unit, i) => sectionQuestions(unit, quotas[i]!, rng));
}

export interface PlacementAnswerKey {
  sectionUnitId: string;
  correct: string;
}

export function placementAnswerKey(questions: readonly PlacementQuestion[]): PlacementAnswerKey[] {
  return questions.map((q) => ({ sectionUnitId: q.sectionUnitId, correct: q.options[q.correctIndex]!.text }));
}

export interface PlacementSectionResult {
  unitId: string;
  correct: number;
  total: number;
  passed: boolean;
}

export interface PlacementGrade {
  sections: PlacementSectionResult[];
  correct: number;
  total: number;
  /** Unit tempat murid mulai; `null` = dari awal jalur (seksi pertama tidak lulus). */
  startUnitId: string | null;
}

/** `answers[i]` = teks opsi yang dipilih untuk soal ke-i, atau `null` untuk "Belum tahu" (dinilai salah). */
export function gradePlacement(
  test: { sectionUnitIds: readonly string[]; nextUnitId: string; key: readonly PlacementAnswerKey[] },
  answers: readonly (string | null)[],
): PlacementGrade {
  if (answers.length !== test.key.length) {
    throw new Error(`Jumlah jawaban (${answers.length}) tidak sama dengan jumlah soal (${test.key.length})`);
  }
  const sections = test.sectionUnitIds.map((unitId): PlacementSectionResult => {
    let correct = 0;
    let total = 0;
    test.key.forEach((k, i) => {
      if (k.sectionUnitId !== unitId) return;
      total++;
      if (answers[i] === k.correct) correct++;
    });
    return { unitId, correct, total, passed: total > 0 && correct * 100 >= PLACEMENT_PASS_PERCENT * total };
  });
  const firstFailed = sections.findIndex((s) => !s.passed);
  const startUnitId = firstFailed === -1 ? test.nextUnitId : firstFailed === 0 ? null : sections[firstFailed]!.unitId;
  return {
    sections,
    correct: sections.reduce((sum, s) => sum + s.correct, 0),
    total: sections.reduce((sum, s) => sum + s.total, 0),
    startUnitId,
  };
}

/** `total` dibagi serata mungkin ke `parts` bagian; sisanya ke bagian-bagian awal. */
function splitEvenly(total: number, parts: number): number[] {
  return Array.from({ length: parts }, (_, i) => Math.floor(total / parts) + (i < total % parts ? 1 : 0));
}

function hasQuestionMaterial(unit: Unit): boolean {
  return unit.lessons.some((l) => l.exercises.some((e) => kanaVariantOf(unit, e) !== null)) || wordCandidates(unit).length > 0;
}

/** Varian latihan pilih-huruf atas kosakata unit, atau null bila latihan itu bukan soal huruf. Varian kosong pada unit
 * huruf berarti kana -> romaji (default ExerciseFactory). */
function kanaVariantOf(unit: Unit, e: Exercise): 'kana_to_romaji' | 'romaji_to_kana' | null {
  if (e.type !== 'choose' || !findVocabById(unit, e.ref)) return null;
  const variant = e.variant ?? 'kana_to_romaji';
  return variant === 'kana_to_romaji' || variant === 'romaji_to_kana' ? variant : null;
}

type Script = 'hiragana' | 'katakana';

function scriptOf(char: string): Script | null {
  const code = char.codePointAt(0)!;
  if (code >= 0x3041 && code <= 0x309f) return 'hiragana';
  if (code >= 0x30a0 && code <= 0x30ff) return 'katakana';
  return null;
}

/** Kata unit yang seluruhnya ditulis dengan aksara yang diajarkan unit itu (aksara huruf-hurufnya): seksi Hiragana
 * hanya menanyakan kata berhiragana, bukan kata katakana atau kanji yang belum diajarkan. Butuh minimal dua arti
 * berbeda supaya ada pengecoh. */
function wordCandidates(unit: Unit): Sentence[] {
  const scripts = new Set<Script>();
  for (const v of unit.vocab) {
    for (const char of v.kana) {
      const script = scriptOf(char);
      if (script) scripts.add(script);
    }
  }
  if (new Set(unit.sentences.map((s) => s.meaning)).size < 2) return [];
  const readable = (text: string) =>
    text.length > 0 &&
    [...text].every((char) => {
      const script = scriptOf(char);
      return script !== null && scripts.has(script);
    });
  return unit.sentences.filter((s) => s.meaning.length > 0 && readable(s.kana));
}

function sectionQuestions(unit: Unit, quota: number, rng: Rng): PlacementQuestion[] {
  const kana = kanaCandidatesByLesson(unit, rng);
  const kanaAvailable = new Set(kana.flatMap((l) => l.exercises.map((e) => e.ref))).size;
  const words = shuffled(wordCandidates(unit), rng);
  // Sepertiga soal kata, sisanya huruf; bila salah satu bahannya kurang, kekurangannya diisi jenis yang lain.
  const kanaCount = Math.min(quota - Math.min(Math.round(quota / 3), words.length), kanaAvailable);
  const wordCount = Math.min(quota - kanaCount, words.length);
  return [
    ...pickKana(kana, kanaCount, rng).map(({ lesson, exercise }) => kanaQuestion(unit, lesson, exercise, rng)),
    ...words.slice(0, wordCount).map((s) => wordQuestion(unit, s, rng)),
  ];
}

interface LessonKana {
  lessonIndex: number;
  lesson: Lesson;
  /** Diacak; satu entri per kosakata (varian pertama yang muncul). */
  exercises: Exercise[];
}

function kanaCandidatesByLesson(unit: Unit, rng: Rng): LessonKana[] {
  return unit.lessons.map((lesson, lessonIndex) => {
    const byRef = new Map<string, Exercise>();
    for (const e of lesson.exercises) {
      if (kanaVariantOf(unit, e) !== null && !byRef.has(e.ref)) byRef.set(e.ref, e);
    }
    return { lessonIndex, lesson, exercises: shuffled([...byRef.values()], rng) };
  });
}

/** Bergiliran antarpelajaran (urutan giliran diacak tiap putaran) supaya soal menyebar ke semua pelajaran -- huruf
 * dasar, dakuten, youon, dst. -- bukan menumpuk di satu pelajaran. Satu kosakata paling banyak satu soal. Hasilnya
 * diurutkan menurut pelajaran. */
function pickKana(lessons: LessonKana[], count: number, rng: Rng): { lessonIndex: number; lesson: Lesson; exercise: Exercise }[] {
  const picked: { lessonIndex: number; lesson: Lesson; exercise: Exercise }[] = [];
  const usedRefs = new Set<string>();
  const queues = lessons.map((l) => ({ ...l, queue: [...l.exercises] }));
  while (picked.length < count && queues.some((q) => q.queue.length > 0)) {
    for (const q of shuffled(queues, rng)) {
      if (picked.length >= count) break;
      let exercise = q.queue.shift();
      while (exercise && usedRefs.has(exercise.ref)) exercise = q.queue.shift();
      if (!exercise) continue;
      usedRefs.add(exercise.ref);
      picked.push({ lessonIndex: q.lessonIndex, lesson: q.lesson, exercise });
    }
  }
  return picked.sort((a, b) => a.lessonIndex - b.lessonIndex);
}

function kanaQuestion(unit: Unit, lesson: Lesson, exercise: Exercise, rng: Rng): PlacementQuestion {
  const prepared = new ExerciseFactory({ unit, lesson, rng }).prepare(exercise);
  if (prepared.kind !== 'choose') throw new Error(`Soal huruf ${exercise.ref} bukan pilihan ganda`);
  return {
    sectionUnitId: unit.id,
    kind: kanaVariantOf(unit, exercise)!,
    refId: prepared.refId,
    prompt: prepared.prompt,
    ...(prepared.promptSub === undefined ? {} : { promptSub: prepared.promptSub }),
    options: prepared.options,
    correctIndex: prepared.correctIndex,
  };
}

/** "Apa arti kata ini?" dengan kata ditulis dalam kana. Kata lain yang bacaannya sama tidak dijadikan pengecoh --
 * artinya juga jawaban sah untuk tulisan yang sama. */
function wordQuestion(unit: Unit, word: Sentence, rng: Rng): PlacementQuestion {
  const seen = new Set<string>([word.meaning]);
  const pool: ChoiceOption[] = [];
  for (const other of unit.sentences) {
    if (other.id === word.id || other.kana === word.kana || seen.has(other.meaning)) continue;
    seen.add(other.meaning);
    pool.push({ text: other.meaning });
  }
  const options = shuffled(pool, rng).slice(0, 3);
  const correctIndex = nextInt(rng, options.length + 1);
  options.splice(correctIndex, 0, { text: word.meaning });
  return { sectionUnitId: unit.id, kind: 'word_meaning', refId: word.id, prompt: word.kana, options, correctIndex };
}
