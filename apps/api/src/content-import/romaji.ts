/** Romaji -> hiragana, untuk menurunkan BACAAN (kana) tulisan Jepang dari romaji yang ditulis pengajar di template konten.
 * Ejaan yang dikenali: Hepburn (shi, chi, tsu, fu, ji, sha/cha/ja) ditambah ejaan Nihon-shiki yang lazim (si, ti, tu, hu, zi, sya,
 * jya), vokal panjang bermakron (ō -> "お" + "ー") atau ditulis "ou"/"oo" (tetap huruf-hurufnya), konsonan ganda (kk -> っ),
 * dan "n'" / "nn" untuk ん. Bukan alat transliterasi serbaguna: kata yang bukan romaji (mis. kata Inggris "check in") dilaporkan
 * sebagai tidak dikenali, bukan ditebak. */

const SMALL: Record<string, string> = { a: "ぁ", i: "ぃ", u: "ぅ", e: "ぇ", o: "ぉ", ya: "ゃ", yu: "ゅ", yo: "ょ" };

const SYLLABLES = new Map<string, string>();

function addRow(consonant: string, kana: readonly [string, string, string, string, string]): void {
  ["a", "i", "u", "e", "o"].forEach((vowel, index) => SYLLABLES.set(consonant + vowel, kana[index] as string));
}

addRow("", ["あ", "い", "う", "え", "お"]);
addRow("k", ["か", "き", "く", "け", "こ"]);
addRow("s", ["さ", "し", "す", "せ", "そ"]);
addRow("t", ["た", "ち", "つ", "て", "と"]);
addRow("n", ["な", "に", "ぬ", "ね", "の"]);
addRow("h", ["は", "ひ", "ふ", "へ", "ほ"]);
addRow("m", ["ま", "み", "む", "め", "も"]);
addRow("r", ["ら", "り", "る", "れ", "ろ"]);
addRow("g", ["が", "ぎ", "ぐ", "げ", "ご"]);
addRow("z", ["ざ", "じ", "ず", "ぜ", "ぞ"]);
addRow("d", ["だ", "ぢ", "づ", "で", "ど"]);
addRow("b", ["ば", "び", "ぶ", "べ", "ぼ"]);
addRow("p", ["ぱ", "ぴ", "ぷ", "ぺ", "ぽ"]);
SYLLABLES.set("ya", "や");
SYLLABLES.set("yu", "ゆ");
SYLLABLES.set("yo", "よ");
SYLLABLES.set("wa", "わ");
SYLLABLES.set("wo", "を");

// Ejaan Hepburn yang berbeda dari baris di atas.
SYLLABLES.set("shi", "し");
SYLLABLES.set("chi", "ち");
SYLLABLES.set("tsu", "つ");
SYLLABLES.set("fu", "ふ");
SYLLABLES.set("ji", "じ");

// Bunyi kecil (youon): konsonan + ya/yu/yo = kana baris-i + ゃゅょ ("kya" = きゃ). Termasuk ejaan Nihon-shiki sya/tya/zya/dya
// dan "jya/jyu/jyo" yang dipakai pengajar untuk じゃ/じゅ/じょ.
for (const [consonant, base] of [
  ["k", "き"],
  ["g", "ぎ"],
  ["n", "に"],
  ["h", "ひ"],
  ["m", "み"],
  ["r", "り"],
  ["b", "び"],
  ["p", "ぴ"],
  ["s", "し"],
  ["t", "ち"],
  ["z", "じ"],
  ["j", "じ"],
  ["d", "ぢ"],
] as const) {
  for (const y of ["ya", "yu", "yo"] as const) SYLLABLES.set(`${consonant}${y}`, `${base}${SMALL[y]}`);
}
SYLLABLES.set("sha", "しゃ");
SYLLABLES.set("shu", "しゅ");
SYLLABLES.set("sho", "しょ");
SYLLABLES.set("cha", "ちゃ");
SYLLABLES.set("chu", "ちゅ");
SYLLABLES.set("cho", "ちょ");
SYLLABLES.set("ja", "じゃ");
SYLLABLES.set("ju", "じゅ");
SYLLABLES.set("jo", "じょ");
// Bunyi serapan (katakana): fa fi fe fo, she, che, je.
SYLLABLES.set("fa", "ふぁ");
SYLLABLES.set("fi", "ふぃ");
SYLLABLES.set("fe", "ふぇ");
SYLLABLES.set("fo", "ふぉ");
SYLLABLES.set("she", "しぇ");
SYLLABLES.set("che", "ちぇ");
SYLLABLES.set("je", "じぇ");

const MAX_SYLLABLE_LENGTH = 3;
const VOWELS = "aiueo";
// Pemisah suku kata yang tidak menghasilkan apa-apa: apostrof (n'a), tanda hubung, serta variannya yang dipakai Word.
const SEPARATORS = new Set(["'", "’", "‘", "`", "´", "-", "‐", "‑"]);
const LONG_MARK = "ー";
/** Pengganti satu kata yang bukan romaji (lihat romajiToReading). */
export const UNKNOWN_READING = "＊";
/** Tanda baca romaji yang dipertahankan sebagai jangkar penyelarasan (koma/titik/tanda seru/tanya -> padanan Jepangnya). */
const PUNCTUATION_READING: Readonly<Record<string, string>> = { ",": "、", ";": "、", ":": "、", ".": "。", "!": "！", "?": "？" };

function isVowel(char: string | undefined): boolean {
  return char !== undefined && char !== "" && VOWELS.includes(char);
}

/** Satu kata romaji -> hiragana. `null` bila ada huruf/urutan yang bukan romaji. Vokal bermakron/sirkumfleks menghasilkan
 * vokal + "ー" (ō -> おー); "ou"/"oo"/"uu" tetap sebagaimana ditulis. */
export function romajiWordToHiragana(word: string): string | null {
  // Pisahkan makron/sirkumfleks (NFD) lalu ubah "vokal + tanda" menjadi "vokal + ー".
  const text = word
    .normalize("NFD")
    .replace(/([aiueoAIUEO])[\u0304\u0302]/g, "$1" + LONG_MARK)
    .normalize("NFC")
    .toLowerCase();

  let out = "";
  let i = 0;
  while (i < text.length) {
    const char = text[i] as string;
    if (char === LONG_MARK) {
      out += LONG_MARK;
      i += 1;
      continue;
    }
    if (SEPARATORS.has(char)) {
      i += 1;
      continue;
    }

    const next = text[i + 1];
    // Konsonan ganda -> っ (kk, ss, tt, pp, ...). "tch" -> っ + ch. Hanya huruf, bukan vokal dan bukan "n".
    if (/[a-z]/.test(char) && !isVowel(char) && char !== "n" && next === char) {
      out += "っ";
      i += 1;
      continue;
    }
    if (char === "t" && text.startsWith("ch", i + 1)) {
      out += "っ";
      i += 1;
      continue;
    }

    if (char === "n") {
      // "n" + vokal/y = baris な; selain itu ん (di akhir kata, sebelum konsonan, "n'" , atau "nn" = ん + な-baris berikutnya).
      if (next === undefined || next === "n" || (next !== "y" && !isVowel(next))) {
        out += "ん";
        i += 1;
        continue;
      }
    }

    let matched = false;
    for (let length = Math.min(MAX_SYLLABLE_LENGTH, text.length - i); length >= 1; length--) {
      const kana = SYLLABLES.get(text.slice(i, i + length));
      if (kana !== undefined) {
        out += kana;
        i += length;
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }
  return out === "" ? null : out;
}

/** Frasa romaji (kata dipisah spasi, boleh bertanda baca) -> satu untai hiragana tanpa spasi. Kata yang bukan romaji diganti
 * `UNKNOWN_READING` (berurutan digabung jadi satu) -- pemanggil memutuskan apa artinya (mis. kata serapan Inggris). Koma/titik/
 * tanda seru/tanda tanya jadi 、。！？ (jangkar: batas antarkata yang ditulis pengajar membantu memisahkan kanji bersebelahan). */
export function romajiToReading(phrase: string): string {
  const tokens = phrase.normalize("NFKC").match(/[^\s,.!?;:()[\]{}"“”/\\]+|[,.!?;:]/g) ?? [];
  let out = "";
  for (const token of tokens) {
    const punctuation = PUNCTUATION_READING[token];
    if (punctuation !== undefined) {
      if (!out.endsWith(punctuation)) out += punctuation;
      continue;
    }
    const kana = romajiWordToHiragana(token);
    if (kana === null) {
      if (!out.endsWith(UNKNOWN_READING)) out += UNKNOWN_READING;
    } else {
      out += kana;
    }
  }
  return out;
}
