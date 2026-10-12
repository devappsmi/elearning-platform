/** Tabel kana (gojūon) per baris konsonan, cara tabel diajarkan di Jepang: tiap baris satu konsonan, tiap kolom satu
 * vokal. Dipakai halaman "Huruf Jepang" di aplikasi murid. Romaji-nya sengaja SAMA dengan konten pelajaran Hiragana
 * (ぢ/づ = ji/zu, を = wo); kanaChart.test.ts memastikan tabel dan isi pelajaran tidak pernah berbeda. Katakana diturunkan
 * dari hiragana (bunyinya sama persis). */

export interface KanaCell {
  kana: string;
  romaji: string;
  /** Bunyi yang tidak mengikuti pola baris (し shi, つ tsu, ふ fu, ...). Ditandai di tabel. */
  irregular?: boolean;
}

export interface KanaRow {
  /** Label baris: konsonannya ("k", "s", ...) atau "vokal". */
  label: string;
  /** Satu sel per kolom; null = tidak ada huruf di posisi itu (mis. yi, ye). */
  cells: (KanaCell | null)[];
}

export interface KanaSection {
  id: 'dasar' | 'dakuten' | 'youon';
  title: string;
  description: string;
  columns: string[];
  rows: KanaRow[];
}

type Raw = string | null; // "か ka" atau "し shi!" (tanda ! = tidak mengikuti pola)

function cell(raw: Raw): KanaCell | null {
  if (raw === null) return null;
  const [kana, romajiRaw] = raw.split(' ') as [string, string];
  const irregular = romajiRaw.endsWith('!');
  const romaji = irregular ? romajiRaw.slice(0, -1) : romajiRaw;
  return irregular ? { kana, romaji, irregular } : { kana, romaji };
}

function row(label: string, ...cells: Raw[]): KanaRow {
  return { label, cells: cells.map(cell) };
}

const VOWELS = ['a', 'i', 'u', 'e', 'o'];

export const HIRAGANA_CHART: readonly KanaSection[] = [
  {
    id: 'dasar',
    title: 'Huruf dasar',
    description: '46 huruf: lima vokal, lalu tiap baris satu konsonan yang digabung dengan kelima vokal itu.',
    columns: VOWELS,
    rows: [
      row('vokal', 'あ a', 'い i', 'う u', 'え e', 'お o'),
      row('k', 'か ka', 'き ki', 'く ku', 'け ke', 'こ ko'),
      row('s', 'さ sa', 'し shi!', 'す su', 'せ se', 'そ so'),
      row('t', 'た ta', 'ち chi!', 'つ tsu!', 'て te', 'と to'),
      row('n', 'な na', 'に ni', 'ぬ nu', 'ね ne', 'の no'),
      row('h', 'は ha', 'ひ hi', 'ふ fu!', 'へ he', 'ほ ho'),
      row('m', 'ま ma', 'み mi', 'む mu', 'め me', 'も mo'),
      row('y', 'や ya', null, 'ゆ yu', null, 'よ yo'),
      row('r', 'ら ra', 'り ri', 'る ru', 'れ re', 'ろ ro'),
      row('w', 'わ wa', null, null, null, 'を wo!'),
      row('n', 'ん n!', null, null, null, null),
    ],
  },
  {
    id: 'dakuten',
    title: 'Dakuten ゛ dan handakuten ゜',
    description: 'Dua titik kecil membuat bunyi lebih berat (か ka → が ga). Lingkaran kecil hanya untuk baris は (は ha → ぱ pa).',
    columns: VOWELS,
    rows: [
      row('g', 'が ga', 'ぎ gi', 'ぐ gu', 'げ ge', 'ご go'),
      row('z', 'ざ za', 'じ ji!', 'ず zu', 'ぜ ze', 'ぞ zo'),
      row('d', 'だ da', 'ぢ ji!', 'づ zu!', 'で de', 'ど do'),
      row('b', 'ば ba', 'び bi', 'ぶ bu', 'べ be', 'ぼ bo'),
      row('p', 'ぱ pa', 'ぴ pi', 'ぷ pu', 'ぺ pe', 'ぽ po'),
    ],
  },
  {
    id: 'youon',
    title: 'Youon (ゃ ゅ ょ kecil)',
    description: 'Huruf berakhiran i digabung や/ゆ/よ kecil menjadi SATU suku kata: き + ゃ = きゃ (kya), bukan "ki-ya".',
    columns: ['ya', 'yu', 'yo'],
    rows: [
      row('ky', 'きゃ kya', 'きゅ kyu', 'きょ kyo'),
      row('sh', 'しゃ sha', 'しゅ shu', 'しょ sho'),
      row('ch', 'ちゃ cha', 'ちゅ chu', 'ちょ cho'),
      row('ny', 'にゃ nya', 'にゅ nyu', 'にょ nyo'),
      row('hy', 'ひゃ hya', 'ひゅ hyu', 'ひょ hyo'),
      row('my', 'みゃ mya', 'みゅ myu', 'みょ myo'),
      row('ry', 'りゃ rya', 'りゅ ryu', 'りょ ryo'),
      row('gy', 'ぎゃ gya', 'ぎゅ gyu', 'ぎょ gyo'),
      row('j', 'じゃ ja', 'じゅ ju', 'じょ jo'),
      row('by', 'びゃ bya', 'びゅ byu', 'びょ byo'),
      row('py', 'ぴゃ pya', 'ぴゅ pyu', 'ぴょ pyo'),
    ],
  },
];

/** Hiragana (U+3041..U+3096) -> katakana; selain itu tidak berubah. Kebalikan dari `katakanaToHiragana`. */
export function hiraganaToKatakana(input: string): string {
  let result = '';
  for (const char of input) {
    const codePoint = char.codePointAt(0)!;
    result += codePoint >= 0x3041 && codePoint <= 0x3096 ? String.fromCodePoint(codePoint + 0x60) : char;
  }
  return result;
}

export const KATAKANA_CHART: readonly KanaSection[] = HIRAGANA_CHART.map((section) => ({
  ...section,
  description: section.description.replace(/[ぁ-ゖ]/g, (ch) => hiraganaToKatakana(ch)),
  title: section.title.replace(/[ぁ-ゖ]/g, (ch) => hiraganaToKatakana(ch)),
  rows: section.rows.map((r) => ({
    ...r,
    cells: r.cells.map((c) => (c === null ? null : { ...c, kana: hiraganaToKatakana(c.kana) })),
  })),
}));

/** Semua sel berisi huruf dari satu tabel, berurutan. */
export function kanaCells(chart: readonly KanaSection[]): KanaCell[] {
  return chart.flatMap((section) => section.rows.flatMap((r) => r.cells.filter((c): c is KanaCell => c !== null)));
}
