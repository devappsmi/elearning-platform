import { describe, expect, test } from 'vitest';
import { furiganaProblem, parseFurigana } from './furigana';

describe('parseFurigana', () => {
  test('memecah teks menjadi bagian biasa dan bagian berfurigana, urutannya tetap', () => {
    expect(parseFurigana('お{名前|なまえ}は{何|なん}ですか。')).toEqual([
      { text: 'お' },
      { text: '名前', reading: 'なまえ' },
      { text: 'は' },
      { text: '何', reading: 'なん' },
      { text: 'ですか。' },
    ]);
  });

  test('tanpa tanda: satu bagian biasa', () => {
    expect(parseFurigana('こんにちは！')).toEqual([{ text: 'こんにちは！' }]);
  });

  test('tanda di awal dan di akhir', () => {
    expect(parseFurigana('{今日|きょう}は{雨|あめ}')).toEqual([
      { text: '今日', reading: 'きょう' },
      { text: 'は' },
      { text: '雨', reading: 'あめ' },
    ]);
  });
});

describe('furiganaProblem', () => {
  test('tanda yang sah', () => {
    expect(furiganaProblem('お{名前|なまえ}は{何|なん}ですか。', 'お名前は何ですか。')).toBeNull();
    expect(furiganaProblem('よろしくお{願|ねが}いします。', 'よろしくお願いします。')).toBeNull();
  });

  test('teks tanpa tanda harus sama persis dengan teks Jepang (kunci audio)', () => {
    expect(furiganaProblem('お{名前|なまえ}はなんですか。', 'お名前は何ですか。')).toMatch(/padahal teks Jepangnya/);
  });

  test('bacaan harus kana, bukan romaji', () => {
    expect(furiganaProblem('{名前|namae}', '名前')).toMatch(/harus kana/);
  });

  test('furigana hanya di atas kanji', () => {
    expect(furiganaProblem('{わたし|わたし}', 'わたし')).toMatch(/hanya untuk kanji/);
  });

  test('tanda yang rusak ketahuan', () => {
    expect(furiganaProblem('{名前なまえ}', '{名前なまえ}')).toMatch(/rusak/);
    expect(furiganaProblem('名前|なまえ', '名前|なまえ')).toMatch(/rusak/);
  });
});
