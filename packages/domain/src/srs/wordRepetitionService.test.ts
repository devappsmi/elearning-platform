import { describe, expect, test } from 'vitest';
import type { Unit } from '../content/types';
import type { SpeakingAttempt } from '../gamification/types';
import { WordRepetitionService } from './wordRepetitionService';

// Port 1:1 dari test/features/progress/word_repetition_stats_test.dart.

function testUnit(): Unit {
  return {
    id: 'unit_hiragana',
    order: 1,
    title: 'Hiragana',
    description: '',
    type: 'kana',
    grammarNotes: [],
    vocab: [{ id: 'k_a', surface: 'あ', kana: 'あ', romaji: 'a', audio: 'k_a.mp3' }],
    sentences: [
      {
        id: 'w_ai',
        surface: '愛',
        kana: 'あい',
        romaji: 'ai',
        meaning: 'cinta',
        words: [{ surface: '愛', kana: 'あい' }],
        audio: 'w_ai.mp3',
        voice: 'female',
      },
    ],
    lessons: [],
  };
}

describe('WordRepetitionService.aggregate', () => {
  test('mengelompokkan per refId: jumlah, skor terbaik, tanggal terakhir', () => {
    const attempts: SpeakingAttempt[] = [
      { refId: 'k_a', score: 60, date: new Date(2026, 8, 1) },
      { refId: 'k_a', score: 90, date: new Date(2026, 8, 3) },
      { refId: 'k_a', score: 75, date: new Date(2026, 8, 2) },
      { refId: 'w_ai', score: 80, date: new Date(2026, 8, 1) },
    ];

    const result = WordRepetitionService.aggregate(attempts);

    expect(result).toHaveLength(2);
    const ka = result.find((r) => r.refId === 'k_a')!;
    expect(ka.attemptCount).toBe(3);
    expect(ka.bestScore).toBe(90);
    expect(ka.lastAttempt).toEqual(new Date(2026, 8, 3));
    const wAi = result.find((r) => r.refId === 'w_ai')!;
    expect(wAi.attemptCount).toBe(1);
    expect(wAi.bestScore).toBe(80);
  });

  test('diurutkan dari yang paling sering dilatih', () => {
    const attempts: SpeakingAttempt[] = [
      { refId: 'a', score: 70, date: new Date(2026, 8, 1) },
      { refId: 'b', score: 70, date: new Date(2026, 8, 1) },
      { refId: 'b', score: 70, date: new Date(2026, 8, 2) },
      { refId: 'b', score: 70, date: new Date(2026, 8, 3) },
    ];
    const result = WordRepetitionService.aggregate(attempts);
    expect(result.map((r) => r.refId)).toEqual(['b', 'a']);
  });

  test('jumlah percobaan sama: yang paling baru dilatih lebih dulu', () => {
    const attempts: SpeakingAttempt[] = [
      { refId: 'old', score: 70, date: new Date(2026, 8, 1) },
      { refId: 'new', score: 70, date: new Date(2026, 8, 5) },
    ];
    const result = WordRepetitionService.aggregate(attempts);
    expect(result.map((r) => r.refId)).toEqual(['new', 'old']);
  });

  test('list kosong menghasilkan list kosong', () => {
    expect(WordRepetitionService.aggregate([])).toEqual([]);
  });
});

describe('WordRepetitionService.resolve', () => {
  test('menemukan vocab dan sentence dari unit', () => {
    const units = [testUnit()];
    const stats = [
      { refId: 'k_a', attemptCount: 3, bestScore: 90, lastAttempt: new Date(2026, 8, 3) },
      { refId: 'w_ai', attemptCount: 1, bestScore: 80, lastAttempt: new Date(2026, 8, 1) },
    ];

    const entries = WordRepetitionService.resolve(stats, units);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.surface).toBe('あ');
    expect(entries[0]!.kana).toBe('あ');
    expect(entries[0]!.meaning).toBeUndefined();
    expect(entries[0]!.stats.attemptCount).toBe(3);
    expect(entries[1]!.surface).toBe('愛');
    expect(entries[1]!.kana).toBe('あい');
    expect(entries[1]!.meaning).toBe('cinta');
    expect(entries[1]!.stats.bestScore).toBe(80);
  });

  test('refId yang tidak ada di konten dilewati tanpa error', () => {
    const units = [testUnit()];
    const stats = [{ refId: 'sudah_dihapus', attemptCount: 1, bestScore: 50, lastAttempt: new Date(2026, 8, 1) }];
    expect(WordRepetitionService.resolve(stats, units)).toEqual([]);
  });

  test('list unit kosong menghasilkan list kosong', () => {
    const stats = [{ refId: 'k_a', attemptCount: 1, bestScore: 50, lastAttempt: new Date(2026, 8, 1) }];
    expect(WordRepetitionService.resolve(stats, [])).toEqual([]);
  });
});
