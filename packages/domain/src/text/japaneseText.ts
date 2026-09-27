/** Utilitas normalisasi teks Jepang dan pengukuran kemiripan string.
 * Port 1:1 dari lib/core/utils/japanese_text.dart -- iterasi per code point
 * (bukan UTF-16 code unit) lewat `for...of` / Array.from, sepadan dengan
 * `.runes` di Dart. */

const IGNORED_CHARS_PATTERN = /[\s、。，．・？！「」『』（）()[\],.?!"']/g;

/** Mengubah katakana (U+30A1..U+30F6) ke hiragana. Tanda ー dibiarkan. */
export function katakanaToHiragana(input: string): string {
  let result = '';
  for (const char of input) {
    const codePoint = char.codePointAt(0)!;
    result += codePoint >= 0x30a1 && codePoint <= 0x30f6 ? String.fromCodePoint(codePoint - 0x60) : char;
  }
  return result;
}

/** Mengubah karakter lebar penuh (ＡＢＣ１２) ke ASCII, spasi lebar penuh ke spasi. */
export function fullwidthToAscii(input: string): string {
  let result = '';
  for (const char of input) {
    const codePoint = char.codePointAt(0)!;
    if (codePoint >= 0xff01 && codePoint <= 0xff5e) {
      result += String.fromCodePoint(codePoint - 0xfee0);
    } else if (codePoint === 0x3000) {
      result += ' ';
    } else {
      result += char;
    }
  }
  return result;
}

/** Membuang spasi dan tanda baca Jepang maupun Latin. */
export function stripIgnored(input: string): string {
  return input.replace(IGNORED_CHARS_PATTERN, '');
}

/** Normalisasi penuh untuk perbandingan transkrip vs target. */
export function normalizeForCompare(input: string): string {
  return stripIgnored(katakanaToHiragana(fullwidthToAscii(input))).toLowerCase();
}

/** Jarak edit Levenshtein pada tingkat code point. */
export function levenshtein(a: string, b: string): number {
  const ra = Array.from(a);
  const rb = Array.from(b);
  if (ra.length === 0) return rb.length;
  if (rb.length === 0) return ra.length;
  let prev = Array.from({ length: rb.length + 1 }, (_, i) => i);
  let curr = new Array<number>(rb.length + 1).fill(0);
  for (let i = 1; i <= ra.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= rb.length; j++) {
      const cost = ra[i - 1] === rb[j - 1] ? 0 : 1;
      // i in [1, ra.length], j in [1, rb.length]; prev/curr selalu punya
      // rb.length + 1 slot -- semua index di bawah ini valid.
      const deletion = prev[j]! + 1;
      const insertion = curr[j - 1]! + 1;
      const substitution = prev[j - 1]! + cost;
      let best = Math.min(deletion, insertion);
      if (substitution < best) best = substitution;
      curr[j] = best;
    }
    [prev, curr] = [curr, prev];
  }
  return prev[rb.length]!;
}

/** Kemiripan 0..100 = (1 - levenshtein / panjang terpanjang) x 100, dibulatkan. */
export function similarityPercent(a: string, b: string): number {
  const la = Array.from(a).length;
  const lb = Array.from(b).length;
  const maxLen = Math.max(la, lb);
  if (maxLen === 0) return 100;
  const distance = levenshtein(a, b);
  return Math.round((1 - distance / maxLen) * 100);
}
