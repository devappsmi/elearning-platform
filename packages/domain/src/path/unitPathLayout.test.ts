import { describe, expect, test } from 'vitest';
import type { Unit } from '../content/types';
import { completedLessonCount, computeAmplitude, deriveNodeStates, milestonePositions } from './unitPathLayout';

// Tidak ada test Dart terpisah -- logika ini sebelumnya inline di widget
// UnitPathCard (_stateOf/_completedCount/amplitude clamp), jadi kasus di
// sini disusun langsung dari perilaku yang terlihat di lib/features/home/
// unit_path_card.dart, bukan dari port test yang sudah ada.

function testUnit(lessonIds: string[]): Unit {
  return {
    id: 'u1',
    order: 1,
    title: 'Unit',
    description: '',
    type: 'kana',
    grammarNotes: [],
    vocab: [],
    sentences: [],
    lessons: lessonIds.map((id) => ({ id, title: id, exercises: [] })),
  };
}

describe('deriveNodeStates', () => {
  test('unit terkunci: semua node locked', () => {
    const unit = testUnit(['l1', 'l2']);
    expect(deriveNodeStates(unit, false, new Set())).toEqual(['locked', 'locked']);
  });

  test('unit terbuka, belum ada yang selesai: hanya node pertama available', () => {
    const unit = testUnit(['l1', 'l2', 'l3']);
    expect(deriveNodeStates(unit, true, new Set())).toEqual(['available', 'locked', 'locked']);
  });

  test('lesson selesai jadi done, berikutnya available', () => {
    const unit = testUnit(['l1', 'l2', 'l3']);
    expect(deriveNodeStates(unit, true, new Set(['u1/l1']))).toEqual(['done', 'available', 'locked']);
  });

  test('semua selesai: semua done', () => {
    const unit = testUnit(['l1', 'l2']);
    expect(deriveNodeStates(unit, true, new Set(['u1/l1', 'u1/l2']))).toEqual(['done', 'done']);
  });
});

test('completedLessonCount menghitung lesson yang selesai saja', () => {
  const unit = testUnit(['l1', 'l2', 'l3']);
  expect(completedLessonCount(unit, new Set(['u1/l1', 'u1/l3']))).toBe(2);
  expect(completedLessonCount(unit, new Set())).toBe(0);
});

describe('computeAmplitude', () => {
  test('dibatasi ke minimum 20 untuk layar sempit', () => {
    expect(computeAmplitude(100)).toBe(20); // 100/2 - 70 = -20, clamp ke 20
  });
  test('dibatasi ke maksimum 80 untuk layar lebar', () => {
    expect(computeAmplitude(1000)).toBe(80); // 1000/2 - 70 = 430, clamp ke 80
  });
  test('nilai di tengah tidak diubah', () => {
    expect(computeAmplitude(300)).toBe(80); // 300/2 - 70 = 80, pas di batas atas
    expect(computeAmplitude(200)).toBe(30); // 200/2 - 70 = 30
  });
});

describe('milestonePositions', () => {
  test('kurang dari 5 node: tidak ada milestone', () => {
    const points = [
      { dx: 0, dy: 0 },
      { dx: 0, dy: 100 },
      { dx: 0, dy: 200 },
      { dx: 0, dy: 300 },
    ];
    expect(milestonePositions(points)).toEqual([]);
  });

  test('satu milestone di antara node ke-4 dan ke-5 (index 3 dan 4)', () => {
    const points = Array.from({ length: 5 }, (_, i) => ({ dx: 0, dy: i * 100 }));
    expect(milestonePositions(points)).toEqual([{ dx: 0, dy: 350 }]);
  });

  test('dua milestone untuk 9 node', () => {
    const points = Array.from({ length: 9 }, (_, i) => ({ dx: 0, dy: i * 100 }));
    expect(milestonePositions(points)).toEqual([
      { dx: 0, dy: 350 },
      { dx: 0, dy: 750 },
    ]);
  });
});
