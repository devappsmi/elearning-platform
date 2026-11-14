import { describe, expect, test } from 'vitest';
import type { Unit } from '../content/types';
import { ExerciseFactory } from './exerciseFactory';
import type { PreparedAssemble, PreparedChoose } from './preparedExercise';

// Port dari test/features/lesson/exercise_factory_test.dart. Test Dart-nya
// pakai `Random(1)` (seed tetap) tapi setiap assertion memeriksa properti
// RELATIF terhadap apa pun yang dihasilkan RNG (mis. "opsi di correctIndex
// isinya benar", bukan "correctIndex == 2") -- jadi bisa di-port tanpa perlu
// meniru urutan PRNG Dart persis, cukup pakai Math.random default.
//
// Exercise bertipe 'speak' pada lesson l1 (ada di fixture versi lama) dihapus
// dari sini, dan test khusus speak diganti test "tidak didukung" -- lihat
// catatan di exerciseFactory.ts/preparedExercise.ts soal kenapa 'speak'
// tidak diporting.

export function buildKanaUnit(): Unit {
  return {
    id: 'unit_hiragana',
    order: 1,
    title: 'Hiragana',
    description: '',
    type: 'kana',
    grammarNotes: [],
    vocab: [
      { id: 'k_a', surface: 'あ', kana: 'あ', romaji: 'a', audio: 'k_a.mp3' },
      { id: 'k_i', surface: 'い', kana: 'い', romaji: 'i', audio: 'k_i.mp3' },
      { id: 'k_u', surface: 'う', kana: 'う', romaji: 'u', audio: 'k_u.mp3' },
      { id: 'k_e', surface: 'え', kana: 'え', romaji: 'e', audio: 'k_e.mp3' },
      { id: 'k_o', surface: 'お', kana: 'お', romaji: 'o', audio: 'k_o.mp3' },
    ],
    sentences: [
      {
        id: 'w_ai',
        surface: '愛',
        kana: 'あい',
        romaji: 'ai',
        meaning: 'cinta',
        words: [{ surface: '愛', kana: 'あい' }],
        assembleTokens: ['あ', 'い'],
        audio: 'w_ai.mp3',
        voice: 'female',
      },
      {
        id: 'w_ie',
        surface: '家',
        kana: 'いえ',
        romaji: 'ie',
        meaning: 'rumah',
        words: [{ surface: '家', kana: 'いえ' }],
        assembleTokens: ['い', 'え'],
        audio: 'w_ie.mp3',
        voice: 'female',
      },
    ],
    lessons: [
      {
        id: 'l1',
        title: 'Baris a',
        exercises: [
          { type: 'choose', ref: 'k_a' },
          { type: 'assemble', ref: 'w_ai' },
        ],
      },
    ],
  };
}

const unit = buildKanaUnit();
const factory = new ExerciseFactory({ unit, lesson: unit.lessons[0]! });

describe('choose', () => {
  test('kana_to_romaji: 4 opsi unik, jawaban benar di correctIndex', () => {
    const p = factory.prepare({ type: 'choose', ref: 'k_a' }) as PreparedChoose;
    expect(p.prompt).toBe('あ');
    expect(p.options).toHaveLength(4);
    expect(p.options[p.correctIndex]!.text).toBe('a');
    expect(new Set(p.options.map((o) => o.text)).size).toBe(4);
    expect(p.isVocab).toBe(true);
  });

  test('romaji_to_kana', () => {
    const p = factory.prepare({ type: 'choose', ref: 'k_i', variant: 'romaji_to_kana' }) as PreparedChoose;
    expect(p.prompt).toBe('i');
    expect(p.options[p.correctIndex]!.text).toBe('い');
  });

  test('varian tidak dikenal melempar error', () => {
    expect(() => factory.prepare({ type: 'choose', ref: 'k_a', variant: 'xxx' })).toThrow();
  });

  test('ref tidak ada melempar error', () => {
    expect(() => factory.prepare({ type: 'assemble', ref: 'tidak_ada' })).toThrow();
  });
});

// Laporan evaluasi pengguna (Okt 2026): ぢ/づ dulu ditulis "dji"/"dzu". Kini ditulis seperti di kamus ("ji"/"zu", sama
// dengan じ/ず), sehingga pengecoh yang berbunyi sama harus dibuang: soal "ji" yang menawarkan じ dan ぢ punya dua
// jawaban benar. Aturannya umum: kosakata yang soalnya sama dengan soal ini tidak pernah jadi pengecoh.
describe('pengecoh tidak boleh ikut benar', () => {
  /** mulberry32: RNG berbiji supaya ratusan susunan opsi bisa dicoba secara deterministik. */
  function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const kana = (id: string, k: string, romaji: string) => ({ id, surface: k, kana: k, romaji, audio: `${id}.mp3` });
  const word = (id: string, surface: string, k: string, meaning: string) => ({ id, surface, kana: k, romaji: '', meaning, audio: `${id}.mp3` });
  const yotsuganaUnit: Unit = {
    ...buildKanaUnit(),
    vocab: [
      kana('k_za', 'ざ', 'za'),
      kana('k_ji', 'じ', 'ji'),
      kana('k_zu', 'ず', 'zu'),
      kana('k_ze', 'ぜ', 'ze'),
      kana('k_da', 'だ', 'da'),
      kana('k_dji', 'ぢ', 'ji'),
      kana('k_dzu', 'づ', 'zu'),
      kana('k_de', 'で', 'de'),
      word('w_ie', '家', 'いえ', 'rumah'),
      word('w_uchi', 'うち', 'うち', 'rumah'),
      word('w_karai', '辛い', 'からい', 'pedas'),
      word('w_tsurai', '辛い', 'つらい', 'berat (perasaan)'),
      word('w_hon', '本', 'ほん', 'buku'),
      word('w_sensei', '先生', 'せんせい', 'guru'),
    ],
    // Pengecoh diambil lebih dulu dari pelajaran yang sama, jadi kata-kata diberi pelajarannya sendiri; kalau tidak,
    // pengecoh soal kata selalu berupa kana dan tes arti kembar lulus tanpa menguji apa-apa.
    lessons: [
      {
        id: 'l4',
        title: 'Dakuten',
        exercises: ['k_za', 'k_ji', 'k_zu', 'k_ze', 'k_da', 'k_dji', 'k_dzu', 'k_de'].map((ref) => ({ type: 'choose' as const, ref })),
      },
      {
        id: 'l_kata',
        title: 'Kata',
        exercises: ['w_ie', 'w_uchi', 'w_karai', 'w_tsurai', 'w_hon', 'w_sensei'].map((ref) => ({ type: 'choose' as const, ref })),
      },
    ],
  };

  /** Semua teks opsi dari 300 susunan acak untuk satu soal. */
  function optionsOver300Seeds(ref: string, variant: string): Set<string> {
    const lesson = yotsuganaUnit.lessons.find((l) => l.exercises.some((e) => e.ref === ref))!;
    const all = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const f = new ExerciseFactory({ unit: yotsuganaUnit, lesson, rng: seeded(seed) });
      const p = f.prepare({ type: 'choose', ref, variant }) as PreparedChoose;
      expect(new Set(p.options.map((o) => o.text)).size).toBe(p.options.length);
      expect(p.options).toHaveLength(4);
      for (const o of p.options) all.add(o.text);
    }
    return all;
  }

  test('soal "ji" untuk ぢ tidak pernah menawarkan じ', () => {
    const offered = optionsOver300Seeds('k_dji', 'romaji_to_kana');
    expect(offered).toContain('ぢ');
    expect(offered).not.toContain('じ');
  });

  test('soal "ji" untuk じ tidak pernah menawarkan ぢ', () => {
    const offered = optionsOver300Seeds('k_ji', 'romaji_to_kana');
    expect(offered).toContain('じ');
    expect(offered).not.toContain('ぢ');
  });

  test('soal づ: jawabannya "zu" dan hanya ada satu opsi "zu"', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const f = new ExerciseFactory({ unit: yotsuganaUnit, lesson: yotsuganaUnit.lessons[0]!, rng: seeded(seed) });
      const p = f.prepare({ type: 'choose', ref: 'k_dzu', variant: 'kana_to_romaji' }) as PreparedChoose;
      expect(p.options[p.correctIndex]!.text).toBe('zu');
      expect(p.options.filter((o) => o.text === 'zu')).toHaveLength(1);
    }
  });

  test('id_to_ja: kata lain yang artinya sama (うち = rumah) tidak jadi pengecoh untuk 家', () => {
    const offered = optionsOver300Seeds('w_ie', 'id_to_ja');
    expect(offered).toContain('家');
    expect(offered).not.toContain('うち');
  });

  test('ja_to_id: arti lain dari tulisan yang sama (辛い: pedas / berat) tidak jadi pengecoh', () => {
    const offered = optionsOver300Seeds('w_karai', 'ja_to_id');
    expect(offered).toContain('pedas');
    expect(offered).not.toContain('berat (perasaan)');
  });
});

test('assemble: bank berisi semua token benar plus pengecoh', () => {
  const p = factory.prepare({ type: 'assemble', ref: 'w_ai' }) as PreparedAssemble;
  expect(p.correct).toEqual(['あ', 'い']);
  expect(p.prompt).toBe('cinta');
  expect(p.promptSub).toBe('ai');
  expect(p.bank).toEqual(expect.arrayContaining(['あ', 'い']));
  expect(p.bank).toContain('え');
  expect(p.bank).toHaveLength(3);
});

test("tipe 'speak' sengaja tidak didukung di port ini", () => {
  expect(() => factory.prepare({ type: 'speak', ref: 'k_a' })).toThrow();
});
