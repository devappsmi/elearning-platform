import type { TutorCharacter, TutorScenario } from "./tutor.const";

export type TutorMode = "roleplay" | "help";
export type TutorRole = "user" | "assistant";

export interface TutorTurn {
  role: TutorRole;
  text: string;
}

/** Aturan dasar -- nada yang tercatat dari versi lama: JLPT N5 pemula,
 * hiragana/katakana + kanji umum, maks 2 kalimat pendek, koreksi dianyam
 * natural (bukan diceramahkan), jangan pernah berganti ke Bahasa Inggris. */
const BASE_RULES = [
  "Kamu adalah lawan bicara latihan percakapan Bahasa Jepang untuk murid Indonesia tingkat pemula (JLPT N5).",
  "Aturan wajib:",
  "- Balas SELALU dalam Bahasa Jepang yang sederhana; pakai hiragana, katakana, dan kanji umum saja (level N5).",
  "- Maksimal 2 kalimat pendek per balasan.",
  "- Kalau murid salah tata bahasa atau kosakata, koreksi dengan menganyamnya secara natural di balasanmu (mis. mengulang kalimat yang benar), jangan menceramahi atau menjelaskan panjang lebar.",
  "- JANGAN PERNAH berganti ke Bahasa Inggris.",
  "- Balas hanya sebagai karakter, tanpa awalan seperti 'assistant:' atau nama karakter.",
].join("\n");

/** Ditaruh PALING AKHIR di instruksi supaya menimpa aturan sebelumnya
 * (termasuk "maks 2 kalimat") -- perilaku override `mode="help"` versi lama:
 * murid minta bantuan, jangan lanjutkan roleplay, beri 2-3 contoh kalimat +
 * arti Indonesia. */
const HELP_OVERRIDE = [
  "MODE BANTUAN (menimpa aturan lain di atas): murid sedang meminta bantuan.",
  "JANGAN lanjutkan roleplay.",
  "Beri 2-3 contoh kalimat Jepang sederhana (level N5) yang bisa dipakai murid untuk membalas di situasi ini, masing-masing diikuti arti dalam Bahasa Indonesia.",
  "Untuk mode bantuan ini boleh memakai Bahasa Indonesia untuk arti dan penjelasan singkat; tetap jangan Bahasa Inggris.",
].join("\n");

/** Satu baris per giliran -- buang pemisah baris DI DALAM teks supaya murid
 * tidak bisa menyelipkan baris "assistant: ..." palsu ke riwayat (kontrak
 * "role: text per baris" tetap utuh). */
function singleLine(text: string): string {
  return text.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

export function buildTutorInstructions(params: {
  scenario: TutorScenario;
  character: TutorCharacter;
  vocab?: readonly string[];
  mode: TutorMode;
}): string {
  const sections = [
    BASE_RULES,
    `Skenario: ${params.scenario.title}\n${params.scenario.systemPrompt}`,
    `Karakter: kamu berperan sebagai ${params.character.name}. ${params.character.personality}`,
  ];

  const vocab = (params.vocab ?? []).map(singleLine).filter((v) => v.length > 0);
  if (vocab.length > 0) {
    sections.push(
      `Kosakata target: usahakan memakai kata-kata berikut secara natural kalau sesuai konteks (jangan dipaksakan): ${vocab.join(", ")}.`,
    );
  }

  if (params.mode === "help") sections.push(HELP_OVERRIDE);

  return sections.join("\n\n");
}

/** Riwayat -> teks "role: text" satu baris per giliran (format `input`
 * Responses API versi lama). */
export function flattenHistory(history: readonly TutorTurn[]): string {
  return history.map((turn) => `${turn.role}: ${singleLine(turn.text)}`).join("\n");
}
