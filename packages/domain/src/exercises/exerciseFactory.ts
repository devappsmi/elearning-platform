import { findSentenceById, findVocabById, type Exercise, type Lesson, type Sentence, type Unit, type Vocab } from '../content/types';
import { nextInt, shuffled, type Rng } from '../shared/random';
import type { ChoiceOption, PreparedAssemble, PreparedChoose, PreparedExercise } from './preparedExercise';

const DISTRACTOR_COUNT = 3;
const ASSEMBLE_DISTRACTOR_COUNT = 2;

/** Mengubah Exercise dari konten menjadi PreparedExercise siap tampil,
 * termasuk memilih pengecoh secara acak. Port dari
 * lib/features/lesson/exercise_factory.dart. `rng` default ke `Math.random`
 * tapi bisa disuntik generator lain saat dites (lihat domain/shared/random.ts).
 *
 * Tipe exercise `speak` dari skema konten lama SENGAJA tidak didukung di
 * sini -- lempar error yang jelas alih-alih diam-diam salah atau bergantung
 * pada pronunciationScorer yang tidak diporting (lihat catatan di
 * preparedExercise.ts). Ini konsisten dengan rencana migrasi konten: `speak`
 * tidak dimigrasikan sebagai Exercise di seeder baru (datanya cuma dipakai
 * jadi Vocab biasa). */
export class ExerciseFactory {
  private readonly unit: Unit;
  private readonly lesson: Lesson;
  private readonly rng: Rng;
  private readonly lessonRefs: Set<string>;

  constructor({ unit, lesson, rng = Math.random }: { unit: Unit; lesson: Lesson; rng?: Rng }) {
    this.unit = unit;
    this.lesson = lesson;
    this.rng = rng;
    this.lessonRefs = new Set(lesson.exercises.map((e) => e.ref));
  }

  prepare(e: Exercise): PreparedExercise {
    switch (e.type) {
      case 'choose':
        return this.choose(e);
      case 'assemble':
        return this.assemble(e);
      case 'speak':
        throw new Error(
          `Tipe exercise 'speak' tidak didukung di packages/domain hasil port ini (ref: ${e.ref}) -- pronunciation scoring sedang didesain ulang, lihat plan Fase 2.`,
        );
    }
  }

  private sentence(ref: string): Sentence {
    const s = findSentenceById(this.unit, ref);
    if (!s) throw new Error(`ref tidak ditemukan di unit ${this.unit.id}: ${ref}`);
    return s;
  }

  private choose(e: Exercise): PreparedChoose {
    const v = findVocabById(this.unit, e.ref);
    if (v) return this.chooseVocab(v, e.variant);
    return this.chooseSentence(this.sentence(e.ref));
  }

  private chooseVocab(v: Vocab, variantOrNull: string | undefined): PreparedChoose {
    const variant = variantOrNull ?? (this.unit.type === 'kana' ? 'kana_to_romaji' : 'ja_to_id');
    switch (variant) {
      case 'kana_to_romaji':
        return this.buildVocabChoice(v, { prompt: v.kana, option: (o) => ({ text: o.romaji }) });
      case 'romaji_to_kana':
        return this.buildVocabChoice(v, { prompt: v.romaji, option: (o) => ({ text: o.kana }) });
      case 'ja_to_id':
        return this.buildVocabChoice(v, {
          prompt: v.surface,
          promptSub: v.kana === v.surface ? undefined : v.kana,
          option: (o) => (o.meaning === undefined ? null : { text: o.meaning }),
        });
      case 'id_to_ja': {
        const meaning = v.meaning;
        if (meaning === undefined) throw new Error(`id_to_ja butuh meaning_id: ${v.id}`);
        return this.buildVocabChoice(v, {
          prompt: meaning,
          option: (o) => ({ text: o.surface, sub: o.kana === o.surface ? undefined : o.kana }),
        });
      }
      default:
        throw new Error(`variant choose tidak dikenal: ${variant}`);
    }
  }

  private buildVocabChoice(
    v: Vocab,
    { prompt, promptSub, option }: { prompt: string; promptSub?: string; option: (v: Vocab) => ChoiceOption | null },
  ): PreparedChoose {
    const correct = option(v);
    if (!correct) throw new Error(`vocab ${v.id} tidak punya data untuk varian ini`);
    const seen = new Set<string>([correct.text]);
    const preferred: ChoiceOption[] = [];
    const others: ChoiceOption[] = [];
    for (const o of this.unit.vocab) {
      if (o.id === v.id) continue;
      const opt = option(o);
      if (!opt || seen.has(opt.text)) continue;
      seen.add(opt.text);
      (this.lessonRefs.has(o.id) ? preferred : others).push(opt);
    }
    const distractors = [...shuffled(preferred, this.rng), ...shuffled(others, this.rng)].slice(0, DISTRACTOR_COUNT);
    const correctIndex = nextInt(this.rng, distractors.length + 1);
    const options = [...distractors];
    options.splice(correctIndex, 0, correct);
    return { kind: 'choose', refId: v.id, isVocab: true, prompt, promptSub, options, correctIndex };
  }

  private chooseSentence(s: Sentence): PreparedChoose {
    const correct: ChoiceOption = { text: s.meaning };
    const seen = new Set<string>([s.meaning]);
    const pool: ChoiceOption[] = [];
    for (const o of this.unit.sentences) {
      if (o.id === s.id || seen.has(o.meaning)) continue;
      seen.add(o.meaning);
      pool.push({ text: o.meaning });
    }
    const distractors = shuffled(pool, this.rng).slice(0, DISTRACTOR_COUNT);
    const correctIndex = nextInt(this.rng, distractors.length + 1);
    const options = [...distractors];
    options.splice(correctIndex, 0, correct);
    return {
      kind: 'choose',
      refId: s.id,
      isVocab: false,
      prompt: s.surface,
      promptSub: s.kana === s.surface ? undefined : s.kana,
      options,
      correctIndex,
    };
  }

  private tokensOf(s: Sentence): string[] {
    return s.assembleTokens ?? s.words.map((w) => w.surface);
  }

  private assemble(e: Exercise): PreparedAssemble {
    const s = this.sentence(e.ref);
    const correct = this.tokensOf(s);
    const correctSet = new Set(correct);
    const pool = new Set<string>();
    for (const o of this.unit.sentences) {
      if (o.id === s.id) continue;
      for (const t of this.tokensOf(o)) {
        if (!correctSet.has(t)) pool.add(t);
      }
    }
    const distractors = shuffled([...pool], this.rng).slice(0, ASSEMBLE_DISTRACTOR_COUNT);
    const bank = shuffled([...correct, ...distractors], this.rng);
    return {
      kind: 'assemble',
      refId: s.id,
      prompt: s.meaning,
      promptSub: this.unit.type === 'kana' ? s.romaji : undefined,
      bank,
      correct,
    };
  }
}
