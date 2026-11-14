import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { unitSchema, type Unit } from '../content/types';
import type { Rng } from '../shared/random';
import {
  buildPlacementTest,
  gradePlacement,
  placementAnswerKey,
  planPlacement,
  PLACEMENT_QUESTION_COUNT,
  type PlacementQuestion,
} from './placementTest';

const hiragana: Unit = unitSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '../content/__fixtures__/unit_hiragana.json'), 'utf-8')),
);

/** RNG deterministik (mulberry32) supaya kegagalan bisa diulang persis. */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stub(id: string, type: Unit['type'], extra: Partial<Unit> = {}): Unit {
  return { id, order: 1, title: id, description: '', type, grammarNotes: [], vocab: [], sentences: [], lessons: [], ...extra };
}

const conversation = stub('unit_n5', 'conversation', { lessons: [{ id: 'c1', title: 'c1', exercises: [] }] });
/** Unit huruf kedua tiruan (katakana) dari hiragana: huruf + kata dipetakan ke katakana. */
const katakana: Unit = {
  ...hiragana,
  id: 'unit_katakana',
  title: 'Katakana',
  vocab: hiragana.vocab.map((v) => ({ ...v, kana: toKatakana(v.kana), surface: toKatakana(v.surface) })),
  sentences: hiragana.sentences.map((s) => ({ ...s, kana: toKatakana(s.kana) })),
};

function toKatakana(text: string): string {
  return [...text].map((c) => (c >= 'ぁ' && c <= 'ゖ' ? String.fromCodePoint(c.codePointAt(0)! + 0x60) : c)).join('');
}

const SEEDS = [1, 2, 3, 7, 42, 2026];

describe('planPlacement', () => {
  test('unit huruf di awal jalur jadi seksi; murid yang lulus mulai di unit sesudahnya', () => {
    const plan = planPlacement([hiragana, conversation]);
    expect(plan?.sections.map((u) => u.id)).toEqual(['unit_hiragana']);
    expect(plan?.nextUnit.id).toBe('unit_n5');
  });

  test('dua unit huruf berturut-turut jadi dua seksi', () => {
    const plan = planPlacement([hiragana, katakana, conversation]);
    expect(plan?.sections.map((u) => u.id)).toEqual(['unit_hiragana', 'unit_katakana']);
    expect(plan?.nextUnit.id).toBe('unit_n5');
  });

  test('unit terakhir tidak pernah dilewati', () => {
    expect(planPlacement([hiragana])).toBeNull();
    expect(planPlacement([hiragana, katakana])?.sections.map((u) => u.id)).toEqual(['unit_hiragana']);
  });

  test('tidak ada unit huruf di awal jalur: tes tidak ditawarkan', () => {
    expect(planPlacement([conversation, hiragana])).toBeNull();
    expect(planPlacement([])).toBeNull();
  });

  test('unit huruf tanpa bahan soal menghentikan deretan seksi', () => {
    const empty = stub('unit_kosong', 'kana', { lessons: [{ id: 'l1', title: 'l1', exercises: [] }] });
    expect(planPlacement([empty, conversation])).toBeNull();
    expect(planPlacement([hiragana, empty, conversation])?.nextUnit.id).toBe('unit_kosong');
  });
});

describe('buildPlacementTest (Hiragana saja)', () => {
  const plan = planPlacement([hiragana, conversation])!;
  const lessonOf = new Map<string, number>();
  hiragana.lessons.forEach((l, i) => l.exercises.forEach((e) => lessonOf.has(e.ref) || lessonOf.set(e.ref, i)));
  const word = (q: PlacementQuestion) => hiragana.sentences.find((s) => s.id === q.refId)!;

  test.each(SEEDS)('15 soal: 10 huruf lalu 5 kata, tanpa kosakata ganda (seed %i)', (seed) => {
    const questions = buildPlacementTest(plan, seeded(seed));
    expect(questions).toHaveLength(PLACEMENT_QUESTION_COUNT);
    expect(questions.map((q) => q.kind === 'word_meaning')).toEqual([...Array(10).fill(false), ...Array(5).fill(true)]);
    expect(new Set(questions.map((q) => q.refId)).size).toBe(15);
    expect(questions.every((q) => q.sectionUnitId === 'unit_hiragana')).toBe(true);
  });

  test.each(SEEDS)('soal huruf menyebar ke ketujuh pelajaran, urut dari pelajaran awal (seed %i)', (seed) => {
    const lessons = buildPlacementTest(plan, seeded(seed))
      .filter((q) => q.kind !== 'word_meaning')
      .map((q) => lessonOf.get(q.refId)!);
    expect(new Set(lessons)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
    expect(lessons).toEqual([...lessons].sort((a, b) => a - b));
  });

  test.each(SEEDS)('jawaban benar ada di correctIndex dan opsinya tidak kembar (seed %i)', (seed) => {
    for (const q of buildPlacementTest(plan, seeded(seed))) {
      const texts = q.options.map((o) => o.text);
      expect(new Set(texts).size).toBe(texts.length);
      expect(texts.length).toBeGreaterThanOrEqual(2);
      if (q.kind === 'word_meaning') {
        expect(texts[q.correctIndex]).toBe(word(q).meaning);
      } else {
        const vocab = hiragana.vocab.find((v) => v.id === q.refId)!;
        expect(q.prompt).toBe(q.kind === 'kana_to_romaji' ? vocab.kana : vocab.romaji);
        expect(texts[q.correctIndex]).toBe(q.kind === 'kana_to_romaji' ? vocab.romaji : vocab.kana);
      }
    }
  });

  test.each(SEEDS)('soal kata: ditulis hiragana saja, tanpa pengecoh yang bacaannya sama (seed %i)', (seed) => {
    for (const q of buildPlacementTest(plan, seeded(seed)).filter((x) => x.kind === 'word_meaning')) {
      expect(q.prompt).toBe(word(q).kana);
      expect(q.prompt).toMatch(/^[ぁ-ゟ]+$/);
      const sameReading = hiragana.sentences.filter((s) => s.kana === q.prompt && s.id !== q.refId).map((s) => s.meaning);
      expect(q.options.some((o) => sameReading.includes(o.text))).toBe(false);
    }
  });

  test('kata yang bacaannya sama (はし) tidak saling jadi pengecoh', () => {
    const base = hiragana.sentences[0]!;
    const homophones: Unit = {
      ...hiragana,
      sentences: [
        { ...base, id: 'w_hashi_bridge', surface: '橋', kana: 'はし', meaning: 'jembatan' },
        { ...base, id: 'w_hashi_chopsticks', surface: '箸', kana: 'はし', meaning: 'sumpit' },
        ...['ねこ=kucing', 'いぬ=anjing', 'やま=gunung', 'うみ=laut'].map((pair, i) => {
          const [kana, meaning] = pair.split('=') as [string, string];
          return { ...base, id: `w_${i}`, surface: kana, kana, meaning };
        }),
      ],
    };
    const p = planPlacement([homophones, conversation])!;
    let asked = 0;
    for (const seed of [...SEEDS, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
      for (const q of buildPlacementTest(p, seeded(seed)).filter((x) => x.prompt === 'はし')) {
        asked++;
        expect(q.options.filter((o) => o.text === 'jembatan' || o.text === 'sumpit')).toHaveLength(1);
      }
    }
    expect(asked).toBeGreaterThan(0);
  });

  test('kata berkatakana tidak pernah ditanyakan di seksi Hiragana', () => {
    const withKatakanaWord: Unit = {
      ...hiragana,
      sentences: hiragana.sentences.map((s) => (s.id === hiragana.sentences[0]!.id ? { ...s, kana: 'パン' } : s)),
    };
    const p = planPlacement([withKatakanaWord, conversation])!;
    for (const seed of SEEDS) {
      expect(buildPlacementTest(p, seeded(seed)).some((q) => q.prompt === 'パン')).toBe(false);
    }
  });
});

describe('buildPlacementTest (pembagian soal)', () => {
  test('dua seksi: 8 + 7 soal, masing-masing sepertiga soal kata', () => {
    const questions = buildPlacementTest(planPlacement([hiragana, katakana, conversation])!, seeded(5));
    const of = (unitId: string) => questions.filter((q) => q.sectionUnitId === unitId);
    expect(of('unit_hiragana')).toHaveLength(8);
    expect(of('unit_katakana')).toHaveLength(7);
    expect(of('unit_hiragana').filter((q) => q.kind === 'word_meaning')).toHaveLength(3);
    expect(of('unit_katakana').filter((q) => q.kind === 'word_meaning')).toHaveLength(2);
    expect(questions.map((q) => q.sectionUnitId)).toEqual([...Array(8).fill('unit_hiragana'), ...Array(7).fill('unit_katakana')]);
    expect(of('unit_katakana').filter((q) => q.kind === 'word_meaning').every((q) => /^[゠-ヿ]+$/.test(q.prompt))).toBe(true);
  });

  test('kosakata yang muncul lagi di pelajaran ulasan tetap hanya ditanyakan sekali', () => {
    const l1 = hiragana.lessons[0]!;
    const withReview: Unit = { ...hiragana, lessons: [l1, { ...l1, id: 'ulasan', title: 'Ulasan' }] };
    for (const seed of SEEDS) {
      const refs = buildPlacementTest(planPlacement([withReview, conversation])!, seeded(seed)).map((q) => q.refId);
      expect(new Set(refs).size).toBe(refs.length);
    }
  });

  test('unit tanpa kata: seluruh kuota diisi soal huruf', () => {
    const noWords: Unit = { ...hiragana, sentences: [] };
    const questions = buildPlacementTest(planPlacement([noWords, conversation])!, seeded(9));
    expect(questions).toHaveLength(15);
    expect(questions.every((q) => q.kind !== 'word_meaning')).toBe(true);
  });

  test('huruf sedikit: kekurangannya diisi soal kata', () => {
    const firstLesson = hiragana.lessons[0]!;
    const fewKana: Unit = {
      ...hiragana,
      lessons: [{ ...firstLesson, exercises: firstLesson.exercises.filter((e) => e.type === 'choose').slice(0, 4) }],
    };
    const questions = buildPlacementTest(planPlacement([fewKana, conversation])!, seeded(9));
    expect(questions).toHaveLength(15);
    expect(questions.filter((q) => q.kind !== 'word_meaning')).toHaveLength(4);
  });
});

describe('gradePlacement', () => {
  const plan = planPlacement([hiragana, conversation])!;
  const questions = buildPlacementTest(plan, seeded(11));
  const key = placementAnswerKey(questions);
  const test1 = { sectionUnitIds: ['unit_hiragana'], nextUnitId: 'unit_n5', key };
  const answering = (correctCount: number) => key.map((k, i) => (i < correctCount ? k.correct : null));

  test('kunci jawaban = teks opsi di correctIndex', () => {
    expect(key.map((k) => k.correct)).toEqual(questions.map((q) => q.options[q.correctIndex]!.text));
  });

  test('benar >= 80% lulus dan mulai di unit sesudahnya; 12/15 pas di ambang', () => {
    expect(gradePlacement(test1, answering(15))).toMatchObject({ correct: 15, total: 15, startUnitId: 'unit_n5' });
    expect(gradePlacement(test1, answering(12))).toMatchObject({ correct: 12, startUnitId: 'unit_n5' });
  });

  test('di bawah 80% atau "Belum tahu" semua: mulai dari awal (null)', () => {
    expect(gradePlacement(test1, answering(11))).toMatchObject({ correct: 11, startUnitId: null });
    expect(gradePlacement(test1, key.map(() => null))).toMatchObject({ correct: 0, startUnitId: null });
  });

  test('jawaban yang bukan teks kunci dinilai salah', () => {
    const wrong = key.map((k) => `${k.correct} `);
    expect(gradePlacement(test1, wrong).correct).toBe(0);
  });

  test('dua seksi: mulai di seksi pertama yang tidak lulus', () => {
    const twoKey = [
      ...Array.from({ length: 8 }, () => ({ sectionUnitId: 'hira', correct: 'a' })),
      ...Array.from({ length: 7 }, () => ({ sectionUnitId: 'kata', correct: 'b' })),
    ];
    const two = { sectionUnitIds: ['hira', 'kata'], nextUnitId: 'n5', key: twoKey };
    const answers = (hira: number, kata: number) => [
      ...Array.from({ length: 8 }, (_, i) => (i < hira ? 'a' : null)),
      ...Array.from({ length: 7 }, (_, i) => (i < kata ? 'b' : null)),
    ];
    expect(gradePlacement(two, answers(8, 7)).startUnitId).toBe('n5');
    expect(gradePlacement(two, answers(7, 6)).startUnitId).toBe('n5'); // 7/8 dan 6/7 >= 80%
    expect(gradePlacement(two, answers(7, 5)).startUnitId).toBe('kata'); // 5/7 = 71%
    expect(gradePlacement(two, answers(6, 7)).startUnitId).toBeNull(); // 6/8 = 75%: Katakana yang lulus tidak berarti
    expect(gradePlacement(two, answers(8, 0)).sections).toEqual([
      { unitId: 'hira', correct: 8, total: 8, passed: true },
      { unitId: 'kata', correct: 0, total: 7, passed: false },
    ]);
  });

  test('jumlah jawaban harus sama dengan jumlah soal', () => {
    expect(() => gradePlacement(test1, answering(15).slice(1))).toThrow(/Jumlah jawaban/);
  });
});
