import { expect, test } from 'vitest';
import { ScenarioSession, TEST_MODE_MAX_MISTAKES } from './scenarioSession';
import type { ScenarioContent } from './types';

function buildScenario(): ScenarioContent {
  return {
    scenarioId: 's1',
    titleId: 'Contoh',
    titleJp: 'サンプル',
    level: 'N5',
    roles: ['a', 'b'],
    estimatedMinutes: 2,
    vocab: [],
    grammarNotes: [],
    lines: [
      { kind: 'narration', speaker: 'a', jp: 'こんにちは', romaji: 'konnichiwa', meaning: 'Halo', audio: '' },
      {
        kind: 'choice',
        speaker: 'b',
        options: [
          { jp: 'こんにちは', correct: true, audio: '' },
          { jp: 'さようなら', correct: false, feedbackId: 'itu artinya selamat tinggal', audio: '' },
        ],
      },
      { kind: 'narration', speaker: 'a', jp: 'げんきですか', romaji: 'genki desu ka', meaning: 'Apa kabar?', audio: '' },
      {
        kind: 'choice',
        speaker: 'b',
        options: [
          { jp: 'げんきです', correct: true, audio: '' },
          { jp: 'いいえ', correct: false, audio: '' },
        ],
      },
    ],
  };
}

test('baris narasi lanjut tanpa perlu dijawab', () => {
  const s = new ScenarioSession({ scenario: buildScenario(), mode: 'practice' });
  expect(s.current.kind).toBe('narration');
  expect(s.progress).toBe(0);
  s.next();
  expect(s.current.kind).toBe('choice');
  expect(s.progress).toBe(0.25);
});

test('mode practice: jawaban salah TETAP di baris yang sama (retry-in-place), tanpa batas', () => {
  const s = new ScenarioSession({ scenario: buildScenario(), mode: 'practice' });
  s.next(); // lewati narasi
  expect(s.current.kind).toBe('choice');

  for (let i = 0; i < 10; i++) {
    const f = s.submitChoice(1); // opsi salah
    expect(f.correct).toBe(false);
    expect(f.feedbackId).toBe('itu artinya selamat tinggal');
    s.next();
    expect(s.isFinished).toBe(false);
    expect(s.current.kind).toBe('choice'); // masih di baris yang sama
  }

  const f = s.submitChoice(0); // akhirnya benar
  expect(f.correct).toBe(true);
  s.next();
  expect(s.current.kind).toBe('narration'); // sekarang baru lanjut
});

test('alur lengkap sampai selesai, hasil akurat', () => {
  const s = new ScenarioSession({ scenario: buildScenario(), mode: 'practice' });
  s.next();
  s.submitChoice(0);
  s.next();
  s.next();
  s.submitChoice(0);
  s.next();

  expect(s.isFinished).toBe(true);
  const r = s.result;
  expect(r.correctCount).toBe(2);
  expect(r.totalChoices).toBe(2);
  expect(r.accuracyPercent).toBe(100);
  expect(r.mistakeCount).toBe(0);
  expect(r.failed).toBe(false);
});

test('mode test: kesempatan salah TIDAK terbatas sebelum melebihi budget', () => {
  const s = new ScenarioSession({ scenario: buildScenario(), mode: 'test' });
  s.next();
  for (let i = 0; i < TEST_MODE_MAX_MISTAKES; i++) {
    s.submitChoice(1);
    expect(s.isFinished).toBe(false); // belum melebihi budget
    s.next();
  }
});

test('mode test: melebihi TEST_MODE_MAX_MISTAKES mengakhiri sesi seketika (gagal)', () => {
  const s = new ScenarioSession({ scenario: buildScenario(), mode: 'test' });
  s.next();
  for (let i = 0; i < TEST_MODE_MAX_MISTAKES; i++) {
    s.submitChoice(1);
    s.next();
  }
  expect(s.isFinished).toBe(false);

  const f = s.submitChoice(1); // kesempatan ke-(MAX+1)
  expect(f.correct).toBe(false);
  expect(s.isFinished).toBe(true); // gagal SEKETIKA, tidak perlu next() lagi
  expect(() => s.current).toThrow();

  // Regresi: alur normal caller adalah submitChoice() lalu next() TANPA cek
  // isFinished di antaranya dulu (persis pola replay ScenariosService) --
  // next() di sini WAJIB no-op, bukan melempar "sesi sudah selesai". Bug ini
  // lolos dari test lain di atas (tidak ada yang memanggil next() persis di
  // titik ini) dan cuma ketahuan lewat verifikasi manual end-to-end.
  expect(() => s.next()).not.toThrow();

  const r = s.result;
  expect(r.failed).toBe(true);
  expect(r.mistakeCount).toBe(TEST_MODE_MAX_MISTAKES + 1);
});

test('submitChoice tanpa jawab dulu lagi (belum next) melempar error', () => {
  const s = new ScenarioSession({ scenario: buildScenario(), mode: 'practice' });
  s.next();
  s.submitChoice(0);
  expect(() => s.submitChoice(0)).toThrow();
});

test('next tanpa feedback (belum submitChoice) melempar error di baris choice', () => {
  const s = new ScenarioSession({ scenario: buildScenario(), mode: 'practice' });
  s.next();
  expect(() => s.next()).toThrow();
});

test('submitChoice di baris narasi melempar error', () => {
  const s = new ScenarioSession({ scenario: buildScenario(), mode: 'practice' });
  expect(() => s.submitChoice(0)).toThrow();
});

test('index opsi di luar jangkauan dianggap salah (bukan crash)', () => {
  const s = new ScenarioSession({ scenario: buildScenario(), mode: 'practice' });
  s.next();
  const f = s.submitChoice(99);
  expect(f.correct).toBe(false);
});
