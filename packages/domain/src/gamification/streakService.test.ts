import { describe, expect, test } from 'vitest';
import { defaultStreakState } from './types';
import { StreakService } from './streakService';

// Port 1:1 dari test/features/progress/streak_service_test.dart.

const d21 = new Date(2026, 8, 21);
const d22 = new Date(2026, 8, 22, 8);
const d23 = new Date(2026, 8, 23);

test('pelajaran pertama memulai streak 1', () => {
  const s = StreakService.onLessonCompleted(defaultStreakState, d21);
  expect(s.current).toBe(1);
  expect(s.longest).toBe(1);
  expect(s.lastActiveDate).toEqual(d21);
});

test('hari berikutnya menambah streak', () => {
  let s = StreakService.onLessonCompleted(defaultStreakState, d21);
  s = StreakService.onLessonCompleted(s, d22);
  expect(s.current).toBe(2);
  expect(s.longest).toBe(2);
});

test('dua pelajaran di hari yang sama tidak menambah', () => {
  let s = StreakService.onLessonCompleted(defaultStreakState, d21);
  s = StreakService.onLessonCompleted(s, new Date(2026, 8, 21, 22));
  expect(s.current).toBe(1);
});

test('melewatkan satu hari memulai ulang dari 1, longest tetap', () => {
  let s = StreakService.onLessonCompleted(defaultStreakState, d21);
  s = StreakService.onLessonCompleted(s, d22);
  s = StreakService.onLessonCompleted(s, new Date(2026, 8, 25));
  expect(s.current).toBe(1);
  expect(s.longest).toBe(2);
});

describe('evaluate', () => {
  test('kemarin aktif = streak tetap, dua hari lalu = 0', () => {
    const s = { current: 4, longest: 4, lastActiveDate: d21 };
    expect(StreakService.evaluate(s, d22).current).toBe(4);
    expect(StreakService.evaluate(s, d23).current).toBe(0);
    expect(StreakService.evaluate(s, d23).longest).toBe(4);
    expect(StreakService.evaluate(defaultStreakState, d23).current).toBe(0);
  });
});
