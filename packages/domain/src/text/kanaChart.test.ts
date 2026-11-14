import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { unitSchema } from '../content/types';
import { HIRAGANA_CHART, KATAKANA_CHART, hiraganaToKatakana, kanaCells } from './kanaChart';
import { katakanaToHiragana } from './japaneseText';

const hiraganaUnit = unitSchema.parse(
  JSON.parse(readFileSync(join(__dirname, '../content/__fixtures__/unit_hiragana.json'), 'utf-8')),
);

describe('HIRAGANA_CHART', () => {
  test('46 huruf dasar, 25 dakuten/handakuten, 33 youon', () => {
    const count = (id: string) => kanaCells(HIRAGANA_CHART.filter((s) => s.id === id)).length;
    expect(count('dasar')).toBe(46);
    expect(count('dakuten')).toBe(25);
    expect(count('youon')).toBe(33);
  });

  test('sama persis dengan 104 kana di pelajaran Hiragana, termasuk romaji-nya', () => {
    const chart = new Map(kanaCells(HIRAGANA_CHART).map((c) => [c.kana, c.romaji]));
    const lessons = new Map(hiraganaUnit.vocab.map((v) => [v.kana, v.romaji]));
    expect(chart.size).toBe(104);
    expect(chart).toEqual(lessons);
  });

  test('setiap baris punya satu sel per kolom', () => {
    for (const section of HIRAGANA_CHART) {
      for (const r of section.rows) expect(r.cells).toHaveLength(section.columns.length);
    }
  });

  test('yang ditandai "tidak mengikuti pola" hanya bunyi yang memang menyimpang', () => {
    const irregular = kanaCells(HIRAGANA_CHART)
      .filter((c) => c.irregular)
      .map((c) => `${c.kana}=${c.romaji}`);
    expect(irregular).toEqual(['し=shi', 'ち=chi', 'つ=tsu', 'ふ=fu', 'を=wo', 'ん=n', 'じ=ji', 'ぢ=ji', 'づ=zu']);
  });
});

describe('KATAKANA_CHART', () => {
  test('bentuk katakana dari tiap huruf hiragana, romaji sama', () => {
    const hira = kanaCells(HIRAGANA_CHART);
    const kata = kanaCells(KATAKANA_CHART);
    expect(kata).toHaveLength(104);
    kata.forEach((c, i) => {
      expect(c.romaji).toBe(hira[i]!.romaji);
      expect(katakanaToHiragana(c.kana)).toBe(hira[i]!.kana);
      expect(c.kana).toMatch(/^[ァ-ヺ]+$/);
    });
    expect(kata.slice(0, 3).map((c) => c.kana)).toEqual(['ア', 'イ', 'ウ']);
    expect(kata.find((c) => c.romaji === 'wo')?.kana).toBe('ヲ');
    expect(kata.find((c) => c.romaji === 'kya')?.kana).toBe('キャ');
  });

  test('keterangan dan judul ikut memakai katakana', () => {
    const youon = KATAKANA_CHART.find((s) => s.id === 'youon')!;
    expect(youon.description).toContain('キ + ャ = キャ (kya)');
    expect(youon.title).toBe('Youon (ャ ュ ョ kecil)');
  });
});

test('hiraganaToKatakana: kebalikan katakanaToHiragana, selain hiragana tidak berubah', () => {
  expect(hiraganaToKatakana('こーひー')).toBe('コーヒー');
  expect(hiraganaToKatakana('漢字とABC')).toBe('漢字トABC');
});
