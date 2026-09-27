import { describe, expect, test } from 'vitest';
import { dateKey, daysBetween } from './dates';

// Port 1:1 dari test/core/dates_test.dart. Ingat: bulan JS Date 0-indexed,
// jadi bulan Dart `9` (September) jadi `8` di sini.

describe('dateKey', () => {
  test('format YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05');
  });
});

describe('daysBetween', () => {
  test('mengabaikan jam', () => {
    expect(daysBetween(new Date(2026, 8, 5, 23), new Date(2026, 8, 6, 1))).toBe(1);
    expect(daysBetween(new Date(2026, 8, 5), new Date(2026, 8, 5))).toBe(0);
    expect(daysBetween(new Date(2026, 8, 6), new Date(2026, 8, 4))).toBe(-2);
  });
});
