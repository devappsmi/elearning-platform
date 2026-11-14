import { UNKNOWN_READING } from "./romaji";

/** Menyelaraskan tulisan Jepang (kanji + kana) dengan BACAAN hiragana-nya (diturunkan dari romaji pengajar, lihat romaji.ts).
 *
 * Prinsip: huruf KANA di tulisan Jepang adalah jangkar -- harus cocok dengan bacaan (は dibaca わ, を dibaca お, へ dibaca え,
 * ー boleh berupa vokal panjang, づ/ず dan ぢ/じ dianggap sama karena romaji tidak membedakannya); deretan KANJI (juga angka dan
 * huruf Latin) di antara jangkar mengambil bacaan apa pun yang tersisa. Hasilnya dua hal sekaligus: bacaan per bagian (untuk
 * baris `kana` dan `words`) dan PEMERIKSAAN -- romaji yang tidak cocok dengan tulisan Jepangnya (salah ketik di template) membuat
 * penyelarasan gagal (`null`), bukan menghasilkan bacaan yang diam-diam salah. */

export interface ReadingSegment {
  /** Potongan tulisan Jepang: satu huruf kana, satu tanda baca, atau satu deretan kanji. */
  jp: string;
  /** Bacaannya. Untuk kana dan tanda baca sama dengan `jp` (katakana tetap katakana). */
  reading: string;
  kind: "kana" | "punctuation" | "kanji";
}

const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x3096;
const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const LONG_MARK = "ー";
const PUNCTUATION_RE = /[\s、。，．！？!?,.:;・「」『』（）()[\]{}"'‘’“”…〜～\-–—/／]/;
const KANA_VOWELS = new Set(["あ", "い", "う", "え", "お"]);
// Tanda baca di sisi bacaan (hasil romajiToReading): jangkar bila tulisan Jepangnya juga punya tanda baca di tempat itu, selain itu dilewati.
const READING_PUNCTUATION = new Set(["、", "。", "！", "？"]);

/** Katakana -> hiragana (huruf lain, termasuk ー, tidak berubah). */
export function toHiragana(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    out += code >= KATAKANA_START && code <= KATAKANA_END ? String.fromCodePoint(code - 0x60) : char;
  }
  return out;
}

function isKanaChar(char: string): boolean {
  const code = char.codePointAt(0) as number;
  return (code >= HIRAGANA_START && code <= HIRAGANA_END) || (code >= KATAKANA_START && code <= KATAKANA_END) || char === LONG_MARK;
}

function isKatakanaChar(char: string): boolean {
  const code = char.codePointAt(0) as number;
  return (code >= KATAKANA_START && code <= KATAKANA_END) || char === LONG_MARK;
}

/** Satu huruf kana di tulisan Jepang cocok dengan satu huruf bacaan? */
function kanaMatches(jpChar: string, readingChar: string): boolean {
  const jp = toHiragana(jpChar);
  if (jp === readingChar) return true;
  if (jp === "は" && readingChar === "わ") return true;
  if (jp === "を" && readingChar === "お") return true;
  if (jp === "へ" && readingChar === "え") return true;
  if ((jp === "づ" && readingChar === "ず") || (jp === "ず" && readingChar === "づ")) return true;
  if ((jp === "ぢ" && readingChar === "じ") || (jp === "じ" && readingChar === "ぢ")) return true;
  // Vokal panjang: ー di satu sisi boleh berupa vokal kana di sisi lain (ō romaji vs おう/おお di tulisan, ー katakana vs ああ).
  if (jp === LONG_MARK && KANA_VOWELS.has(readingChar)) return true;
  if (readingChar === LONG_MARK && KANA_VOWELS.has(jp)) return true;
  return false;
}

/** Pecah tulisan Jepang jadi: tanda baca, huruf kana satuan (jangkar), dan deretan kanji (bacaan belum diketahui). */
function splitSegments(jp: string): { text: string; kind: ReadingSegment["kind"] }[] {
  const segments: { text: string; kind: ReadingSegment["kind"] }[] = [];
  for (const char of jp) {
    const kind: ReadingSegment["kind"] = PUNCTUATION_RE.test(char) ? "punctuation" : isKanaChar(char) ? "kana" : "kanji";
    const last = segments[segments.length - 1];
    if (kind === "kanji" && last?.kind === "kanji") last.text += char;
    else segments.push({ text: char, kind });
  }
  return segments;
}

/** Selaraskan `jp` dengan `reading` (hiragana, boleh memuat `UNKNOWN_READING` untuk kata non-romaji seperti "check in" yang
 * mewakili deretan katakana). `null` bila tidak ada penyelarasan yang cocok. */
export function alignReading(jp: string, reading: string): ReadingSegment[] | null {
  const readingChars = Array.from(toHiragana(reading));
  const segments = splitSegments(jp);
  const memo = new Map<number, string[] | null>();

  const restIsPunctuation = (from: number): boolean => readingChars.slice(from).every((char) => READING_PUNCTUATION.has(char));

  // Mengembalikan bacaan tiap segmen mulai `segmentIndex` (sejajar dengan `segments`), atau null bila buntu.
  const solve = (segmentIndex: number, readingIndex: number): string[] | null => {
    if (segmentIndex === segments.length) return restIsPunctuation(readingIndex) ? [] : null;
    const key = segmentIndex * (readingChars.length + 1) + readingIndex;
    if (memo.has(key)) return memo.get(key) ?? null;

    const segment = segments[segmentIndex] as { text: string; kind: ReadingSegment["kind"] };
    const here = readingChars[readingIndex];
    let result: string[] | null = null;

    if (segment.kind === "punctuation") {
      // Tanda baca Jepang memakan tanda baca bacaan di tempat yang sama bila ada (jangkar), bila tidak ia berdiri sendiri.
      const withAnchor = here !== undefined && READING_PUNCTUATION.has(here) ? solve(segmentIndex + 1, readingIndex + 1) : null;
      const rest = withAnchor ?? solve(segmentIndex + 1, readingIndex);
      result = rest ? [segment.text, ...rest] : null;
    } else if (here !== undefined && READING_PUNCTUATION.has(here)) {
      // Tanda baca di romaji yang tak punya padanan di tulisan Jepang: dilewati.
      result = solve(segmentIndex, readingIndex + 1);
    } else if (segment.kind === "kana") {
      if (here === UNKNOWN_READING && isKatakanaChar(segment.text)) {
        // "＊" = kata asing yang ditulis katakana: ambil satu atau lebih huruf katakana berurutan.
        const taken: string[] = [];
        for (let end = segmentIndex; end < segments.length; end++) {
          const candidate = segments[end] as { text: string; kind: ReadingSegment["kind"] };
          if (candidate.kind !== "kana" || !isKatakanaChar(candidate.text)) break;
          taken.push(candidate.text);
          const rest = solve(end + 1, readingIndex + 1);
          if (rest) {
            result = [...taken, ...rest];
            break;
          }
        }
      } else if (here !== undefined && kanaMatches(segment.text, here)) {
        const rest = solve(segmentIndex + 1, readingIndex + 1);
        result = rest ? [segment.text, ...rest] : null;
      }
    } else {
      // Deretan kanji: ambil 1..n huruf bacaan (terpendek dulu), sisanya harus cocok untuk segmen berikutnya.
      for (let length = 1; readingIndex + length <= readingChars.length; length++) {
        const piece = readingChars.slice(readingIndex, readingIndex + length);
        if (piece.some((char) => char === UNKNOWN_READING || READING_PUNCTUATION.has(char))) break;
        const rest = solve(segmentIndex + 1, readingIndex + length);
        if (rest) {
          result = [piece.join(""), ...rest];
          break;
        }
      }
    }

    memo.set(key, result);
    return result;
  };

  const readings = solve(0, 0);
  if (!readings) return null;

  // `readings` sejajar 1:1 dengan `segments` (satu entri per segmen, termasuk tiap huruf katakana yang diambil oleh "＊").
  return segments.map((segment, index) => ({
    jp: segment.text,
    reading: segment.kind === "kanji" ? (readings[index] as string) : segment.text,
    kind: segment.kind,
  }));
}

/** Bacaan untuk potongan [start, end) dari tulisan Jepang (indeks UTF-16 pada untai aslinya), dari hasil `alignReading`.
 * `null` bila batasnya memotong satu deretan kanji (bacaan satu deretan kanji tidak bisa dibelah). */
export function readingOfRange(segments: readonly ReadingSegment[], start: number, end: number): string | null {
  let offset = 0;
  let out = "";
  for (const segment of segments) {
    const segStart = offset;
    const segEnd = offset + segment.jp.length;
    offset = segEnd;
    if (segEnd <= start) continue;
    if (segStart >= end) break;
    const fullyInside = segStart >= start && segEnd <= end;
    if (!fullyInside) {
      // Kana/tanda baca satuan tak mungkin terbelah; yang bisa terbelah hanya deretan kanji.
      if (segment.kind === "kanji") return null;
    }
    out += segment.reading;
  }
  return out;
}

/** Gabungan bacaan seluruh segmen = baris `kana` kalimat (kana asli dipertahankan, kanji diganti bacaannya). */
export function readingText(segments: readonly ReadingSegment[]): string {
  return segments.map((segment) => segment.reading).join("");
}
