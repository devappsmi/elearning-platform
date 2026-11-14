/** Furigana (bacaan kecil di atas kanji) di konten ditulis dengan tanda {dasar|bacaan}, mis.
 * "お{名前|なまえ}は{何|なん}ですか。". Ditulis di field terpisah, bukan di teks Jepangnya, karena teks itu juga kunci audio
 * (PRD 9.4). `furiganaProblem` memastikan tanda furigana tidak diam-diam mengubah kalimat: tanpa tandanya, teks harus
 * sama persis dengan teks Jepang aslinya. */

export interface RubySegment {
  text: string;
  /** Bacaan kana untuk `text`; tidak ada = teks biasa tanpa furigana. */
  reading?: string;
}

const MARK = /\{([^{}|]+)\|([^{}|]+)\}/g;
const KANJI = /[㐀-䶿一-鿿々〆]/;
const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/;

export function parseFurigana(marked: string): RubySegment[] {
  const segments: RubySegment[] = [];
  let last = 0;
  for (const match of marked.matchAll(MARK)) {
    if (match.index > last) segments.push({ text: marked.slice(last, match.index) });
    segments.push({ text: match[1]!, reading: match[2]! });
    last = match.index + match[0].length;
  }
  if (last < marked.length) segments.push({ text: marked.slice(last) });
  return segments;
}

/** Pesan galat untuk penulis konten, atau null bila tanda furigana `marked` sah untuk teks Jepang `jp`. */
export function furiganaProblem(marked: string, jp: string): string | null {
  const segments = parseFurigana(marked);
  for (const s of segments) {
    if (s.reading === undefined) {
      if (/[{}|]/.test(s.text)) return `tanda furigana rusak di "${s.text}" (pakai {kanji|bacaan})`;
    } else {
      if (!KANJI.test(s.text)) return `furigana hanya untuk kanji, bukan untuk "${s.text}"`;
      if (!KANA_ONLY.test(s.reading)) return `bacaan "${s.reading}" untuk "${s.text}" harus kana`;
    }
  }
  const plain = segments.map((s) => s.text).join('');
  if (plain !== jp) return `tanpa tanda furigana teksnya "${plain}", padahal teks Jepangnya "${jp}"`;
  return null;
}
