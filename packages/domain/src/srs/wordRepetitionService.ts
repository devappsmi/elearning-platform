import { findSentenceById, findVocabById, type Unit } from '../content/types';
import type { SpeakingAttempt } from '../gamification/types';

/** Ringkasan berapa kali satu kata/kalimat sudah dilatih di latihan speak,
 * diambil dari riwayat SpeakingAttempt. Port dari
 * lib/features/progress/word_repetition_stats.dart. */
export interface WordRepetitionStats {
  refId: string;
  attemptCount: number;
  bestScore: number;
  lastAttempt: Date;
}

/** Baris siap tampil: WordRepetitionStats digabung dengan teks kata/kalimat
 * aslinya (dicari dari konten unit yang sedang dimuat). */
export interface WordRepetitionEntry {
  surface: string;
  kana: string;
  meaning?: string;
  stats: WordRepetitionStats;
}

export const WordRepetitionService = {
  /** Mengelompokkan attempts per refId: jumlah percobaan, skor terbaik, dan
   * tanggal percobaan terakhir. Diurutkan dari yang paling sering dilatih;
   * kata dengan jumlah percobaan sama diurutkan dari yang paling baru dilatih. */
  aggregate(attempts: SpeakingAttempt[]): WordRepetitionStats[] {
    const byRef = new Map<string, SpeakingAttempt[]>();
    for (const a of attempts) {
      const list = byRef.get(a.refId);
      if (list) list.push(a);
      else byRef.set(a.refId, [a]);
    }
    const result: WordRepetitionStats[] = [...byRef.entries()].map(([refId, list]) => ({
      refId,
      attemptCount: list.length,
      bestScore: Math.max(...list.map((a) => a.score)),
      lastAttempt: list.reduce((a, b) => (a.date > b.date ? a : b)).date,
    }));
    result.sort((a, b) => {
      const byCount = b.attemptCount - a.attemptCount;
      return byCount !== 0 ? byCount : b.lastAttempt.getTime() - a.lastAttempt.getTime();
    });
    return result;
  },

  /** Mencari teks kata/kalimat untuk tiap stats di units. Entri yang refId-nya
   * sudah tidak ada di konten (mis. konten berubah) dilewati. */
  resolve(stats: WordRepetitionStats[], units: Unit[]): WordRepetitionEntry[] {
    const entries: WordRepetitionEntry[] = [];
    for (const s of stats) {
      for (const u of units) {
        const vocab = findVocabById(u, s.refId);
        if (vocab) {
          entries.push({ surface: vocab.surface, kana: vocab.kana, meaning: vocab.meaning, stats: s });
          break;
        }
        const sentence = findSentenceById(u, s.refId);
        if (sentence) {
          entries.push({ surface: sentence.surface, kana: sentence.kana, meaning: sentence.meaning, stats: s });
          break;
        }
      }
    }
    return entries;
  },
};
