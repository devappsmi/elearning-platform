import type { Lesson, Unit } from '../content/types';
import { ExerciseFactory } from '../exercises/exerciseFactory';
import type { PreparedExercise } from '../exercises/preparedExercise';
import type { Rng } from '../shared/random';

export interface AnswerFeedback {
  correct: boolean;
  correctAnswer: string;
}

export interface LessonResult {
  correctFirstTry: number;
  correctSubmissions: number;
  totalSubmissions: number;
  learnedVocabIds: Set<string>;
  accuracyPercent: number;
}

interface QueueItem {
  prepared: PreparedExercise;
  attempts: number;
}

/** Menjalankan antrean latihan satu pelajaran. Tidak bergantung pada React/Next
 * -- port dari lib/features/lesson/lesson_session.dart. Kelas biasa (bukan
 * immutable): dipanggil lewat store tipis di lapisan UI yang mem-bump versi
 * setelah tiap panggilan mutasi, padanan `setState` implisit Flutter untuk
 * instance ini.
 *
 * PERUBAHAN dari versi lama (bukan port 1:1): latihan tipe `speak` (dan skor/
 * XP yang menyertainya -- `speakHighCount`, `skippedSpeak`, `speakingRecords`,
 * `averageSpeakingScore`) SENGAJA tidak diporting -- lihat catatan di
 * exerciseFactory.ts/preparedExercise.ts. Konsekuensinya, `LessonResult` di
 * sini TIDAK menghitung `xp` sama sekali lagi (versi lama memanggil
 * `XpService.lessonXp({correctFirstTry, speakHighCount})` di getter `result`).
 * XP lesson di PRD v4.0 dihitung dari RATING BINTANG
 * (`XpService.lessonXp(stars)` di gamification/xpService.ts menerima
 * `1|2|3`), dan `LessonSession` di sini tidak (belum) punya konsep bintang --
 * itu keputusan produk yang belum didesain (lihat plan, bagian "Yang Masih
 * Perlu Dikonfirmasi"), bukan sesuatu yang aman diasumsikan/ditebak saat
 * porting. Memanggil `XpService.lessonXp(stars)` jadi tanggung jawab lapisan
 * pemanggil (mis. `LessonsModule` di apps/api) begitu skema penilaian
 * bintang sudah didesain, bukan tanggung jawab kelas ini. */
export class LessonSession {
  readonly unit: Unit;
  readonly lesson: Lesson;

  private readonly queue: QueueItem[] = [];
  private done = 0;
  private correctFirstTry = 0;
  private correctSubmissions = 0;
  private totalSubmissions = 0;
  private readonly learnedVocabIds = new Set<string>();
  private pending: AnswerFeedback | null = null;

  constructor({ unit, lesson, rng }: { unit: Unit; lesson: Lesson; rng?: Rng }) {
    this.unit = unit;
    this.lesson = lesson;
    const factory = new ExerciseFactory({ unit, lesson, rng });
    for (const e of lesson.exercises) {
      this.queue.push({ prepared: factory.prepare(e), attempts: 0 });
    }
  }

  get isFinished(): boolean {
    return this.queue.length === 0;
  }

  get current(): PreparedExercise {
    if (this.isFinished) throw new Error('sesi sudah selesai');
    return this.queue[0]!.prepared;
  }

  /** 0..1 berdasarkan item yang sudah tuntas dibanding total tersisa. */
  get progress(): number {
    const total = this.done + this.queue.length;
    return total === 0 ? 1 : this.done / total;
  }

  get pendingFeedback(): AnswerFeedback | null {
    return this.pending;
  }

  private ensureNoPending(): void {
    if (this.pending !== null) throw new Error('panggil next() dulu sebelum menjawab lagi');
  }

  /** `current as PreparedX` di Dart adalah cast yang DICEK saat runtime (lempar
   * kalau tipenya salah). `as` TypeScript murni cuma anotasi tipe -- tidak
   * mengecek apa pun saat runtime -- jadi padanan yang jujur butuh guard
   * eksplisit ini, bukan bare `as`, supaya salah panggil tetap gagal keras
   * seperti versi Dart-nya. */
  private currentOfKind<K extends PreparedExercise['kind']>(kind: K): Extract<PreparedExercise, { kind: K }> {
    const c = this.current;
    if (c.kind !== kind) throw new Error(`Diharapkan latihan tipe '${kind}', tapi current bertipe '${c.kind}'`);
    return c as Extract<PreparedExercise, { kind: K }>;
  }

  private markLearned(p: PreparedExercise): void {
    if (p.kind === 'choose' && p.isVocab) this.learnedVocabIds.add(p.refId);
  }

  private recordAnswer(correct: boolean, correctAnswer: string): AnswerFeedback {
    this.ensureNoPending();
    // ensureNoPending() tidak mengecek queue kosong, tapi tiap caller publik
    // (submitChoice/submitAssemble) sudah lewat currentOfKind() -> current()
    // yang melempar kalau isFinished -- jadi queue[0] di sini selalu ada.
    const item = this.queue[0]!;
    item.attempts++;
    this.totalSubmissions++;
    if (correct) {
      this.correctSubmissions++;
      if (item.attempts === 1) this.correctFirstTry++;
      this.markLearned(item.prepared);
    }
    this.pending = { correct, correctAnswer };
    return this.pending;
  }

  submitChoice(index: number): AnswerFeedback {
    const ex = this.currentOfKind('choose');
    return this.recordAnswer(index === ex.correctIndex, ex.options[ex.correctIndex]!.text);
  }

  submitAssemble(tokens: string[]): AnswerFeedback {
    const ex = this.currentOfKind('assemble');
    const correct = tokens.length === ex.correct.length && tokens.every((t, i) => t === ex.correct[i]);
    return this.recordAnswer(correct, ex.correct.join(' '));
  }

  next(): void {
    const p = this.pending;
    if (p === null) throw new Error('tidak ada feedback yang menunggu');
    const item = this.queue.shift()!;
    if (p.correct) {
      this.done++;
    } else {
      this.queue.push(item);
    }
    this.pending = null;
  }

  get result(): LessonResult {
    const accuracyPercent =
      this.totalSubmissions === 0 ? 100 : Math.round((this.correctSubmissions * 100) / this.totalSubmissions);
    return {
      correctFirstTry: this.correctFirstTry,
      correctSubmissions: this.correctSubmissions,
      totalSubmissions: this.totalSubmissions,
      learnedVocabIds: new Set(this.learnedVocabIds),
      accuracyPercent,
    };
  }
}
