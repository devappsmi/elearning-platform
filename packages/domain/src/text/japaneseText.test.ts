import { describe, expect, test } from 'vitest';
import {
  fullwidthToAscii,
  katakanaToHiragana,
  levenshtein,
  normalizeForCompare,
  similarityPercent,
} from './japaneseText';

// Port 1:1 dari test/core/japanese_text_test.dart, termasuk kasus sama persis.

describe('katakanaToHiragana', () => {
  test('mengubah katakana ke hiragana, ー dipertahankan', () => {
    expect(katakanaToHiragana('コーヒー')).toBe('こーひー');
  });
  test('hiragana dan kanji tidak berubah', () => {
    expect(katakanaToHiragana('今日はいい天気')).toBe('今日はいい天気');
  });
});

describe('fullwidthToAscii', () => {
  test('mengubah huruf dan angka lebar penuh', () => {
    expect(fullwidthToAscii('ＡＢＣ　１２')).toBe('ABC 12');
  });
});

describe('normalizeForCompare', () => {
  test('membuang tanda baca dan spasi', () => {
    expect(normalizeForCompare('今、何時ですか？')).toBe('今何時ですか');
  });
  test('menyamakan katakana dan spasi', () => {
    expect(normalizeForCompare('オハヨウ ございます。')).toBe('おはようございます');
  });
  test('lowercase untuk romaji', () => {
    expect(normalizeForCompare('Ohayou')).toBe('ohayou');
  });
});

describe('levenshtein', () => {
  test('contoh klasik', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
  test('string kosong', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
  test('string sama', () => {
    expect(levenshtein('いまなんじ', 'いまなんじ')).toBe(0);
  });
});

describe('similarityPercent', () => {
  test('sama persis = 100', () => {
    expect(similarityPercent('いまなんじですか', 'いまなんじですか')).toBe(100);
  });
  test('satu karakter kurang dari 8', () => {
    expect(similarityPercent('いまなんじです', 'いまなんじですか')).toBe(88);
  });
  test('keduanya kosong = 100', () => {
    expect(similarityPercent('', '')).toBe(100);
  });
  test('salah satu kosong = 0', () => {
    expect(similarityPercent('', 'あ')).toBe(0);
  });
});
