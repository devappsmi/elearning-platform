import { expect, test } from 'vitest';
import type { Unit } from '../content/types';
import { UnlockRules } from './unlockRules';

// Port 1:1 dari test/features/home/unlock_rules_test.dart.

function testUnit(id: string, order: number, lessonIds: string[]): Unit {
  return {
    id,
    order,
    title: id,
    description: '',
    type: 'kana',
    grammarNotes: [],
    vocab: [],
    sentences: [],
    lessons: lessonIds.map((l) => ({ id: l, title: l, exercises: [] })),
  };
}

const units = [testUnit('u1', 1, ['l1', 'l2']), testUnit('u2', 2, ['l1'])];

test('unit pertama selalu terbuka, unit kedua terbuka setelah unit pertama tuntas', () => {
  expect(UnlockRules.isUnitUnlocked(units, 0, new Set())).toBe(true);
  expect(UnlockRules.isUnitUnlocked(units, 1, new Set())).toBe(false);
  expect(UnlockRules.isUnitUnlocked(units, 1, new Set(['u1/l1']))).toBe(false);
  expect(UnlockRules.isUnitUnlocked(units, 1, new Set(['u1/l1', 'u1/l2']))).toBe(true);
});

test('pelajaran terbuka berurutan', () => {
  expect(UnlockRules.isLessonUnlocked(units[0]!, 0, new Set())).toBe(true);
  expect(UnlockRules.isLessonUnlocked(units[0]!, 1, new Set())).toBe(false);
  expect(UnlockRules.isLessonUnlocked(units[0]!, 1, new Set(['u1/l1']))).toBe(true);
});

test('unit tanpa pelajaran tidak dianggap tuntas', () => {
  expect(UnlockRules.isUnitComplete(testUnit('x', 1, []), new Set())).toBe(false);
});
