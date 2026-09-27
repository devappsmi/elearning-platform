import { describe, expect, test } from 'vitest';
import { mascotMessage } from './mascotMessage';

// Port 1:1 dari test/features/home/mascot_greeting_test.dart.

describe('mascotMessage', () => {
  test('target harian tercapai mengalahkan pesan lain', () => {
    expect(mascotMessage({ goalReachedToday: true, streak: 0 })).toBe('Target harian tercapai. Sampai jumpa besok.');
    expect(mascotMessage({ goalReachedToday: true, streak: 5 })).toBe('Target harian tercapai. Sampai jumpa besok.');
  });

  test('streak nol dan target belum tercapai: ajakan memulai', () => {
    expect(mascotMessage({ goalReachedToday: false, streak: 0 })).toBe('Mulai hari ini untuk memulai streak-mu.');
  });

  test('streak berjalan dan target belum tercapai: ajakan lanjut', () => {
    expect(mascotMessage({ goalReachedToday: false, streak: 3 })).toBe('Ayo lanjutkan, jangan putus streak-mu.');
  });
});
