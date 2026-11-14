import type { ScenarioContent, ScenarioLine } from './types';

export type ScenarioMode = 'practice' | 'test';

/** CONV-04 AC: "3x kesempatan salah total". Jumlah MAKSIMUM jawaban salah
 * yang ditoleransi sebelum sesi mode tes berakhir gagal -- proposal, PRD
 * tidak memberi alternatif angka untuk dibandingkan (beda dari star->XP
 * yang setidaknya punya rentang di PRD). Lihat docs/PLAN.md. */
export const TEST_MODE_MAX_MISTAKES = 3;

export interface ScenarioAnswerFeedback {
  correct: boolean;
  /** Catatan koreksi Bahasa Indonesia (CONV-02 `feedback_id`) -- biasanya
   * cuma ada di opsi yang SALAH, tapi tidak dipaksa (opsi benar pun boleh
   * punya catatan tambahan kalau kontennya begitu). */
  feedbackId?: string;
}

export interface ScenarioResult {
  correctCount: number;
  totalChoices: number;
  accuracyPercent: number;
  mistakeCount: number;
  /** true kalau mode tes berakhir karena kehabisan kesempatan salah --
   * skenario TIDAK dianggap tuntas penuh (lihat LessonsModule padanannya:
   * accuracyPercent tetap dihitung dari yang sempat dijawab, bukan diblok). */
  failed: boolean;
}

/** Menjalankan satu skenario percakapan ber-template (CONV-01..04). BUKAN
 * port -- tidak ada padanan di app lama, lihat catatan di scenario/types.ts.
 * Desainnya SENGAJA beda dari LessonSession di satu hal penting: jawaban
 * salah TIDAK diantre ulang ke akhir (seperti LessonSession) -- baris
 * dialog itu LINEAR/naratif, mengantre ulang ke akhir akan membuat murid
 * lihat balasan lawan bicara atas baris BERIKUTNYA sebelum baris mereka
 * sendiri saat ini selesai, merusak alur percakapan. Jadi jawaban salah
 * membuat sesi TETAP di baris yang sama untuk diulang (retry-in-place),
 * bukan requeue-to-end.
 *
 * Mode practice (CONV-03): retry tanpa batas, tidak pernah gagal.
 * Mode test (CONV-04): retry tetap diizinkan tapi tiap jawaban salah
 * memotong "kesempatan salah" bersama (TEST_MODE_MAX_MISTAKES) -- begitu
 * habis, sesi berakhir SAAT ITU JUGA (isFinished true), tidak menunggu
 * baris-baris sisanya. Baris narasi (bukan choice) tidak perlu dijawab --
 * panggil next() langsung untuk lanjut. */
export class ScenarioSession {
  readonly scenario: ScenarioContent;
  readonly mode: ScenarioMode;

  private readonly lines: ScenarioLine[];
  private index = 0;
  private correctCount = 0;
  private totalChoices = 0;
  private mistakeCount = 0;
  private failed = false;
  private pending: ScenarioAnswerFeedback | null = null;

  constructor({ scenario, mode }: { scenario: ScenarioContent; mode: ScenarioMode }) {
    this.scenario = scenario;
    this.mode = mode;
    this.lines = scenario.lines;
  }

  get isFinished(): boolean {
    return this.failed || this.index >= this.lines.length;
  }

  /** Index baris SEKARANG di `scenario.lines` -- beda dari LessonSession
   * (yang tidak punya padanan ini): di sana urutan antrean berubah (wrong
   * requeue-to-end) jadi "index" tidak stabil sebagai pengecekan integritas,
   * makanya dipakai `refId`. Di sini urutan baris SELALU linear/tetap
   * (retry-in-place, tidak pernah requeue) dan opsi TIDAK PERNAH diacak sama
   * sekali (beda dari opsi choose lesson yang di-shuffle ExerciseFactory) --
   * index posisi cukup dan aman dipakai caller (ScenariosService) sebagai
   * pengecekan integritas replay + untuk submit BY INDEX langsung (tidak
   * perlu pola value-based seperti lesson). */
  get currentIndex(): number {
    if (this.isFinished) throw new Error('sesi sudah selesai');
    return this.index;
  }

  get current(): ScenarioLine {
    if (this.isFinished) throw new Error('sesi sudah selesai');
    return this.lines[this.index]!;
  }

  get progress(): number {
    return this.lines.length === 0 ? 1 : this.index / this.lines.length;
  }

  get pendingFeedback(): ScenarioAnswerFeedback | null {
    return this.pending;
  }

  private currentOfKind<K extends ScenarioLine['kind']>(kind: K): Extract<ScenarioLine, { kind: K }> {
    const c = this.current;
    if (c.kind !== kind) throw new Error(`Diharapkan baris tipe '${kind}', tapi current bertipe '${c.kind}'`);
    return c as Extract<ScenarioLine, { kind: K }>;
  }

  submitChoice(optionIndex: number): ScenarioAnswerFeedback {
    if (this.pending !== null) throw new Error('panggil next() dulu sebelum menjawab lagi');
    const line = this.currentOfKind('choice');
    const chosen: { jp: string; correct: boolean; feedbackId?: string } | undefined = line.options[optionIndex];
    const correct = chosen?.correct === true;

    this.totalChoices++;
    if (correct) {
      this.correctCount++;
    } else {
      this.mistakeCount++;
      if (this.mode === 'test' && this.mistakeCount > TEST_MODE_MAX_MISTAKES) this.failed = true;
    }
    this.pending = { correct, feedbackId: chosen?.feedbackId };
    return this.pending;
  }

  /** Baris choice: lanjut ke baris berikutnya kalau jawaban BENAR; kalau
   * salah, tetap di baris yang sama (retry-in-place, lihat catatan kelas
   * ini) KECUALI sesi baru saja gagal (mode test, kesempatan habis) --
   * dalam kasus itu sesi sudah selesai (isFinished true), next() jadi no-op.
   * Baris narasi: selalu lanjut, tidak perlu submitChoice dulu.
   *
   * Guard `isFinished` di baris pertama SENGAJA (bukan cuma optimisasi) --
   * submitChoice() bisa membuat sesi selesai SEKETIKA (this.failed = true,
   * budget mode test habis) SEBELUM next() ini sempat dipanggil; tanpa
   * guard ini, `this.current` di bawah melempar "sesi sudah selesai" walau
   * caller cuma mengikuti alur normal submitChoice()->next(). Ketahuan
   * lewat verifikasi manual ScenariosService (bukan cuma dites unit),
   * lihat docs/PLAN.md. */
  next(): void {
    if (this.isFinished) return;
    const line = this.current;
    if (line.kind === 'choice') {
      if (this.pending === null) throw new Error('tidak ada feedback yang menunggu -- jawab dulu (submitChoice)');
      const wasCorrect = this.pending.correct;
      this.pending = null;
      if (this.failed) return; // baru saja gagal (test) -- sesi berakhir DI BARIS INI, jangan advance
      if (!wasCorrect) return; // retry-in-place
    }
    this.index++;
  }

  get result(): ScenarioResult {
    const accuracyPercent = this.totalChoices === 0 ? 100 : Math.round((this.correctCount * 100) / this.totalChoices);
    return { correctCount: this.correctCount, totalChoices: this.totalChoices, accuracyPercent, mistakeCount: this.mistakeCount, failed: this.failed };
  }
}
