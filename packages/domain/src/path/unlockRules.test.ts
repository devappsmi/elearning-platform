import { describe, expect, test } from 'vitest';
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

describe('unit awal dari tes penempatan (startIndex)', () => {
  const path = [testUnit('hira', 1, ['l1', 'l2']), testUnit('kata', 2, ['l1']), testUnit('n5', 3, ['l1']), testUnit('n5b', 4, ['l1'])];

  test('unit yang dilewati dan unit awalnya terbuka tanpa menuntaskan unit sebelumnya', () => {
    expect([0, 1, 2, 3].map((i) => UnlockRules.isUnitUnlocked(path, i, new Set(), 2))).toEqual([true, true, true, false]);
  });

  test('unit sesudah unit awal kembali berurutan', () => {
    expect(UnlockRules.isUnitUnlocked(path, 3, new Set(['n5/l1']), 2)).toBe(true);
  });

  test('tanpa startIndex perilakunya sama seperti sebelumnya', () => {
    expect([0, 1, 2].map((i) => UnlockRules.isUnitUnlocked(path, i, new Set()))).toEqual([true, false, false]);
  });

  test('startIndexOf: posisi unit awal, 0 bila kosong atau tidak ditemukan', () => {
    expect(UnlockRules.startIndexOf(path, 'n5')).toBe(2);
    expect(UnlockRules.startIndexOf(path, null)).toBe(0);
    expect(UnlockRules.startIndexOf(path, undefined)).toBe(0);
    expect(UnlockRules.startIndexOf(path, 'sudah-dihapus')).toBe(0);
  });
});

test('unit tanpa pelajaran tidak dianggap tuntas', () => {
  expect(UnlockRules.isUnitComplete(testUnit('x', 1, []), new Set())).toBe(false);
});
