import type { components } from "@elearning/api-client";

/** Tes penempatan (PRD AUTH-05, docs/PLAN.md bagian 7q). */
export const PLACEMENT_PATH = "/placement";

export type PlacementQuestionKind = components["schemas"]["PlacementQuestionView"]["kind"];

/** Perintah di atas soal, per jenis soal. */
export const PLACEMENT_INSTRUCTION: Record<PlacementQuestionKind, string> = {
  kana_to_romaji: "Bagaimana cara membaca huruf ini?",
  romaji_to_kana: "Pilih huruf untuk bunyi ini.",
  word_meaning: "Apa arti kata ini?",
};

/** "Hiragana", "Hiragana dan Katakana", "A, B, dan C". */
export function joinTitles(titles: readonly string[]): string {
  if (titles.length <= 1) return titles[0] ?? "";
  if (titles.length === 2) return `${titles[0]} dan ${titles[1]}`;
  return `${titles.slice(0, -1).join(", ")}, dan ${titles[titles.length - 1]}`;
}

/** Jawaban benar minimal agar satu bagian lulus (>= passPercent). */
export function minimumCorrect(total: number, passPercent: number): number {
  return Math.ceil((total * passPercent) / 100);
}
