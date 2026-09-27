import { expect, test } from 'vitest';
import { BadgeService, type BadgeContext } from './badgeService';

// Port 1:1 dari test/features/progress/badge_service_test.dart.

function ctx({
  lessons = 0,
  streak = 0,
  words = 0,
  speakHigh = 0,
  units = new Set<string>(),
  awarded = new Set<string>(),
}: {
  lessons?: number;
  streak?: number;
  words?: number;
  speakHigh?: number;
  units?: Set<string>;
  awarded?: Set<string>;
} = {}): BadgeContext {
  return {
    lessonsCompleted: lessons,
    streakCurrent: streak,
    wordsLearned: words,
    speakingHighCount: speakHigh,
    completedUnitIds: units,
    awarded,
  };
}

test('tidak ada lencana saat kosong', () => {
  expect(BadgeService.evaluate(ctx())).toEqual([]);
});

test('pelajaran pertama', () => {
  expect(BadgeService.evaluate(ctx({ lessons: 1 }))).toEqual([BadgeService.firstLesson]);
});

test('sudah diraih tidak diberikan lagi', () => {
  expect(BadgeService.evaluate(ctx({ lessons: 3, awarded: new Set([BadgeService.firstLesson]) }))).toEqual([]);
});

test('streak, kata, speaker', () => {
  const got = BadgeService.evaluate(ctx({ lessons: 1, streak: 30, words: 100, speakHigh: 50 }));
  expect(got).toEqual(
    expect.arrayContaining([
      BadgeService.firstLesson,
      BadgeService.streak7,
      BadgeService.streak30,
      BadgeService.words100,
      BadgeService.speaker50,
    ]),
  );
});

test('unit kana dan unit percakapan', () => {
  const got = BadgeService.evaluate(
    ctx({ lessons: 1, units: new Set(['unit_hiragana', 'unit_katakana', 'unit_01_salam']) }),
  );
  expect(got).toEqual(
    expect.arrayContaining([BadgeService.hiraganaMaster, BadgeService.katakanaMaster, 'unit_01_salam_complete']),
  );
  expect(got).not.toContain('unit_hiragana_complete');
});
