import { expect, test } from 'vitest';
import { buildKanaUnit } from '../exercises/exerciseFactory.test';
import type { PreparedChoose } from '../exercises/preparedExercise';
import { LessonSession } from './lessonSession';

// Port dari test/features/lesson/lesson_session_test.dart, DISESUAIKAN: lesson
// fixture (buildKanaUnit, di exerciseFactory.test.ts) di package ini cuma
// punya 2 exercise (choose + assemble, tanpa 'speak' -- lihat catatan di
// lessonSession.ts), jadi langkah dan assertion seputar speak
// (submitSpeaking/skipSpeaking/xp/speakHighCount/speakingRecords/
// averageSpeakingScore) dihapus, bukan diporting apa adanya.

test('alur lengkap: salah diantre ulang, lalu benar', () => {
  const unit = buildKanaUnit();
  const s = new LessonSession({ unit, lesson: unit.lessons[0]! });
  expect(s.progress).toBe(0);
  expect(s.isFinished).toBe(false);

  // 1. choose, jawab salah
  const choose = s.current as PreparedChoose;
  const wrongIndex = (choose.correctIndex + 1) % choose.options.length;
  const f1 = s.submitChoice(wrongIndex);
  expect(f1.correct).toBe(false);
  expect(f1.correctAnswer).toBe('a');
  expect(s.pendingFeedback).not.toBeNull();
  s.next();
  expect(s.progress).toBe(0);
  expect(s.pendingFeedback).toBeNull();

  // 2. assemble benar
  expect(s.current.kind).toBe('assemble');
  expect(s.submitAssemble(['あ', 'い']).correct).toBe(true);
  s.next();
  expect(s.progress).toBeCloseTo(1 / 2, 5);

  // 3. choose yang diantre ulang, sekarang benar
  const again = s.current as PreparedChoose;
  expect(s.submitChoice(again.correctIndex).correct).toBe(true);
  s.next();
  expect(s.isFinished).toBe(true);

  const r = s.result;
  expect(r.correctFirstTry).toBe(1);
  expect(r.totalSubmissions).toBe(3);
  expect(r.correctSubmissions).toBe(2);
  expect(r.accuracyPercent).toBe(67);
  expect(r.learnedVocabIds).toEqual(new Set(['k_a']));
});

test('assemble urutan salah dianggap salah', () => {
  const unit = buildKanaUnit();
  const s = new LessonSession({ unit, lesson: unit.lessons[0]! });
  s.submitChoice((s.current as PreparedChoose).correctIndex);
  s.next();
  const f = s.submitAssemble(['い', 'あ']);
  expect(f.correct).toBe(false);
  expect(f.correctAnswer).toBe('あ い');
});

test('next tanpa feedback melempar error', () => {
  const unit = buildKanaUnit();
  const s = new LessonSession({ unit, lesson: unit.lessons[0]! });
  expect(() => s.next()).toThrow();
});
