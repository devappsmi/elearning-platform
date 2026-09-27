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
