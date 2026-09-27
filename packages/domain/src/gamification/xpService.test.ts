import { expect, test } from 'vitest';
import { XP_PER_STAR, XpService, starsForScore } from './xpService';

// DITULIS ULANG untuk formula PRD v4.0 (§GAM-01/GAM-03) -- BUKAN port 1:1
// dari xp_service_test.dart lama. Formula dan level curve-nya sendiri sudah
// beda total (lihat komentar di xpService.ts), jadi assertion lama
// (`10 + correctFirstTry + 5*speakHighCount`, level curve 100×n) akan
// menguji angka yang sudah tidak berlaku lagi.

test('lessonXp mengikuti mapping bintang -> XP (1★=10, 2★=20, 3★=30)', () => {
  expect(XpService.lessonXp(1)).toBe(10);
  expect(XpService.lessonXp(2)).toBe(20);
  expect(XpService.lessonXp(3)).toBe(30);
});

test('lessonXp konsisten dengan konstanta XP_PER_STAR yang diekspor', () => {
  expect(XpService.lessonXp(1)).toBe(XP_PER_STAR[1]);
  expect(XpService.lessonXp(2)).toBe(XP_PER_STAR[2]);
  expect(XpService.lessonXp(3)).toBe(XP_PER_STAR[3]);
});

test('checkpoint, skenario/percakapan, dan kuis harian sesuai angka PRD', () => {
  expect(XpService.checkpointXp).toBe(50);
  expect(XpService.scenarioXp).toBe(20);
  expect(XpService.dailyQuizXp).toBe(10);
});

test('levelForXp: level n ke n+1 butuh 1000 x n XP', () => {
  expect(XpService.levelForXp(0).level).toBe(1);
  expect(XpService.levelForXp(999).level).toBe(1);
  expect(XpService.levelForXp(999).xpForNextLevel).toBe(1000);
  expect(XpService.levelForXp(1000).level).toBe(2);
  expect(XpService.levelForXp(1000).xpIntoLevel).toBe(0);
  expect(XpService.levelForXp(1000).xpForNextLevel).toBe(2000);
  expect(XpService.levelForXp(2999).level).toBe(2);
  expect(XpService.levelForXp(3000).level).toBe(3);
  expect(XpService.levelForXp(3500).xpIntoLevel).toBe(500);
});

test('starsForScore mengikuti ambang LP-03 (80-89=1, 90-99=2, 100=3)', () => {
  expect(starsForScore(80)).toBe(1);
  expect(starsForScore(89)).toBe(1);
  expect(starsForScore(90)).toBe(2);
  expect(starsForScore(99)).toBe(2);
  expect(starsForScore(100)).toBe(3);
});

test('starsForScore menolak skor di bawah ambang lulus', () => {
  expect(() => starsForScore(79)).toThrow();
  expect(() => starsForScore(0)).toThrow();
});
