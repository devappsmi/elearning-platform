/** Pengurai TEMPLATE konten pengajar "Percakapan di Tempat Kerja" (berkas Word): paragraf teks -> struktur bagian/entri/blok.
 *
 * Bentuk template (satu unit per berkas):
 *
 *   Percakapan di Tempat Kerja（職場での会話 Shokuba de no kaiwa）      <- judul kursus (Indonesia + Jepang + romaji)
 *   N4–N3                                                           <- tingkat
 *   Unit 3                                                          <- nomor unit
 *   Keadaan Sedang Berlangsung (～ている ... te iru )                 <- BAGIAN = satu pola tata bahasa (nama + pola)
 *     ・ Hajimeru – Hajimete iru – Hajimete iru tokoro desu           <- ENTRI: rangkaian bentuk (romaji)
 *        始める – 始めている – 始めているところです                          (Jepang)
 *        Mulai – Sedang mulai – Baru saja (sedang) mulai              (Indonesia)
 *     Kaigi ga hajimete iru tokoro desu                              <- BLOK kalimat bertahap, tiga baris
 *        会議が始めているところです                                         romaji / Jepang / Indonesia; tiap blok
 *        Rapatnya baru saja mulai                                      memperpanjang blok sebelumnya (dari frasa
 *     Choudo ima, kaigi ga hajimete iru tokoro desu.                  pendek ke kalimat penuh)
 *        ちょうど今、会議が始めているところです。
 *        Tepat sekarang, rapatnya baru saja mulai.
 *
 * Aturan baca: nomor bagian otomatis Word (tidak ada di teks) diberi urut; nomor tertulis ("10a. ") dipakai apa adanya. Blok
 * yang romaji/Jepang-nya berisi pemisah " – " adalah RANGKAIAN BENTUK (mis. kata dasar -> bentuk pola), selain itu KALIMAT; kalimat
 * dengan dua bentuk setara dipisah "/" (ようです/みたいです) menjadi dua alternatif. Pengurai TIDAK menebak: baris yang tidak
 * cocok bentuknya dilewati dan dilaporkan di `warnings` -- penyusun unit (unit-builder.ts) dan peninjau manusia yang memutuskan. */

export interface TemplatePart {
  jp: string;
  romaji: string;
  id: string;
}

/** Rangkaian bentuk: tiap elemen satu langkah (kata dasar, bentuk -ている, bentuk pola, ...) dalam tiga bahasa. */
export interface TemplateChain {
  kind: "chain";
  parts: TemplatePart[];
}

export interface TemplateSentenceAlt {
  jp: string;
  romaji: string;
}

/** Kalimat (atau frasa) dengan satu terjemahan. `alts` > 1 bila template menulis dua bentuk setara dipisah "/". */
export interface TemplateSentence {
  kind: "sentence";
  alts: TemplateSentenceAlt[];
  id: string;
}

export type TemplateBlock = TemplateChain | TemplateSentence;

export interface TemplateEntry {
  /** Rangkaian pembuka entri (baris yang diawali "・"). */
  head: TemplateChain;
  /** Sisanya, berurutan: rangkaian tambahan (kata bantu untuk langkah berikutnya) dan kalimat bertahap. */
  blocks: TemplateBlock[];
}

export interface TemplateSection {
  /** Urutan 1, 2, 3, ... di dokumen (dipakai untuk id pelajaran). */
  position: number;
  /** Label tampilan: nomor tertulis ("10a") atau urutannya. */
  label: string;
  titleId: string;
  /** Pola, mis. "～ている" atau "～よう/～みたい". */
  patternJp: string;
  /** Romaji pola seperti ditulis template, mis. "te iru". */
  patternRomaji: string;
  entries: TemplateEntry[];
}

export interface TemplateWarning {
  where: string;
  message: string;
  /** Sudah ditinjau dan diterima pengimpor (lihat `ImportOverrides.acceptedWarnings`) -- bukan lagi masalah yang menunggu. */
  accepted?: boolean;
}

export interface ParsedTemplate {
  courseTitleId: string;
  courseTitleJp: string;
  courseTitleRomaji: string;
  /** Mis. "N4–N3"; "" bila tidak tertulis. */
  levelLabel: string;
  unitNumber: number | null;
  sections: TemplateSection[];
  warnings: TemplateWarning[];
}

const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/;
const HEADING_RE = /^(?:(\d+)([a-z])?\.\s*)?(.+?)\s*[（(]\s*(～[^）)]*?)\s*(?:\.{3}|…)\s*([^）)]*?)\s*[）)]\s*$/;
// Awal entri: titik tengah "・", boleh didahului angka lingkaran ①-⑳ (penomoran entri yang diketik pengajar di Word).
const ENTRY_START_RE = /^(?:[\u2460-\u2473]\s*)?[・•·]\s*/;
const FORM_MARKER_RE = /^(?:top|bottom) of form$/i;
const LEVEL_RE = /^N[1-5](?:\s*[–—-]\s*N[1-5])?$/;
const UNIT_NUMBER_RE = /^Unit\s*(\d+)\b/i;
const COURSE_TITLE_RE = /^(.+?)\s*[（(]\s*([^）)]+?)\s*[）)]$/;
// Pemisah rangkaian: tanda pisah en/em (spasi di sekitarnya bebas) atau tanda hubung BERSPASI (agar "laki-laki" tidak terpecah).
const CHAIN_SEPARATOR_RE = /\s*[–—]\s*|\s+-\s+/;
const ALTERNATIVE_SEPARATOR_RE = /\s*[/／]\s*/;

function hasJapanese(text: string): boolean {
  return JAPANESE_RE.test(text);
}

/** Satu baris template -> teks bersih: tab/spasi lebar/NBSP jadi spasi biasa, spasi beruntun dipadatkan, ujung dipangkas. */
function cleanLine(raw: string): string {
  return raw.normalize("NFC").replace(/[\t\u00a0\u3000\u2000-\u200a]/g, " ").replace(/ {2,}/g, " ").trim();
}

/** Teks Latin (romaji/Indonesia): tanda baca dan huruf lebar-penuh ("ｄ", "．") dibakukan ke bentuk biasa. */
function cleanLatin(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** Teks Jepang: semua spasi dibuang (kalimat Jepang tidak memakai spasi; spasi di template hanya tata letak). */
function cleanJapanese(text: string): string {
  return text.replace(/\s+/g, "");
}

function splitChain(text: string): string[] {
  return text
    .split(CHAIN_SEPARATOR_RE)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

function splitAlternatives(text: string): string[] {
  return text
    .split(ALTERNATIVE_SEPARATOR_RE)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

interface Triple {
  romaji: string;
  jp: string;
  id: string;
}

/** Kelompokkan baris berurutan jadi tiga-tiga (romaji / Jepang / Indonesia). Bila tiga baris berurutan tidak berbentuk itu,
 * satu baris dilewati (dilaporkan) lalu mencoba lagi -- supaya satu baris yang rusak tidak menggeser seluruh sisa entri. */
function groupTriples(lines: readonly string[], where: string, warnings: TemplateWarning[]): Triple[] {
  const triples: Triple[] = [];
  let index = 0;
  while (index < lines.length) {
    const romaji = lines[index];
    const jp = lines[index + 1];
    const id = lines[index + 2];
    if (romaji !== undefined && jp !== undefined && id !== undefined && !hasJapanese(romaji) && hasJapanese(jp) && !hasJapanese(id)) {
      triples.push({ romaji, jp, id });
      index += 3;
      continue;
    }
    warnings.push({ where, message: `baris dilewati karena tidak membentuk kelompok romaji / Jepang / Indonesia: "${romaji ?? ""}"` });
    index += 1;
  }
  return triples;
}

function toChain(triple: Triple, where: string, warnings: TemplateWarning[]): TemplateChain {
  const romaji = splitChain(cleanLatin(triple.romaji));
  const jp = splitChain(triple.jp).map(cleanJapanese);
  const id = splitChain(cleanLatin(triple.id));
  const length = Math.max(romaji.length, jp.length, id.length);
  if (romaji.length !== jp.length || jp.length !== id.length) {
    warnings.push({
      where,
      message: `rangkaian "${triple.romaji}" tidak sama panjang di tiga baris (romaji ${romaji.length}, Jepang ${jp.length}, Indonesia ${id.length}); bagian yang kurang dikosongkan`,
    });
  }
  const parts: TemplatePart[] = [];
  for (let i = 0; i < length; i++) parts.push({ romaji: romaji[i] ?? "", jp: jp[i] ?? "", id: id[i] ?? "" });
  return { kind: "chain", parts };
}

function toSentence(triple: Triple, where: string, warnings: TemplateWarning[]): TemplateSentence {
  const jpAlts = splitAlternatives(triple.jp).map(cleanJapanese);
  const romajiAlts = splitAlternatives(cleanLatin(triple.romaji));
  if (jpAlts.length !== romajiAlts.length) {
    warnings.push({
      where,
      message: `kalimat "${triple.romaji}" punya ${romajiAlts.length} bentuk di romaji tetapi ${jpAlts.length} di tulisan Jepang; dipasangkan menurut urutan, sisanya dibuang`,
    });
  }
  const alts: TemplateSentenceAlt[] = jpAlts.map((jp, i) => ({ jp, romaji: romajiAlts[i] ?? "" }));
  return { kind: "sentence", alts, id: cleanLatin(triple.id) };
}

function isChainTriple(triple: Triple): boolean {
  return splitChain(triple.romaji).length > 1 || splitChain(triple.jp).length > 1;
}

function buildEntry(lines: readonly string[], where: string, warnings: TemplateWarning[]): TemplateEntry | null {
  const triples = groupTriples(lines, where, warnings);
  const [headTriple, ...rest] = triples;
  if (!headTriple) {
    warnings.push({ where, message: "entri tanpa rangkaian pembuka (tiga baris pertama) dilewati" });
    return null;
  }
  const head = toChain(headTriple, where, warnings);
  const blocks: TemplateBlock[] = rest.map((triple) => (isChainTriple(triple) ? toChain(triple, where, warnings) : toSentence(triple, where, warnings)));
  return { head, blocks };
}

interface CourseHeader {
  courseTitleId: string;
  courseTitleJp: string;
  courseTitleRomaji: string;
  levelLabel: string;
  unitNumber: number | null;
}

function parseHeader(lines: readonly string[], warnings: TemplateWarning[]): CourseHeader {
  const header: CourseHeader = { courseTitleId: "", courseTitleJp: "", courseTitleRomaji: "", levelLabel: "", unitNumber: null };
  for (const line of lines) {
    const unit = UNIT_NUMBER_RE.exec(line);
    if (unit) {
      header.unitNumber = Number(unit[1]);
      continue;
    }
    if (LEVEL_RE.test(line)) {
      header.levelLabel = line.replace(/\s+/g, "");
      continue;
    }
    const title = COURSE_TITLE_RE.exec(line);
    if (title && !header.courseTitleId) {
      header.courseTitleId = (title[1] ?? "").trim();
      const inside = (title[2] ?? "").trim();
      const split = /^([぀-ヿ㐀-鿿]+)\s+([A-Za-z].*)$/.exec(inside);
      header.courseTitleJp = split ? (split[1] ?? "").trim() : inside;
      header.courseTitleRomaji = split ? (split[2] ?? "").trim() : "";
      continue;
    }
    warnings.push({ where: "judul dokumen", message: `baris tidak dikenali dan dilewati: "${line}"` });
  }
  return header;
}

/** Paragraf dokumen (hasil `readDocxParagraphs`) -> struktur template. Tidak melempar untuk isi yang janggal: semuanya masuk `warnings`. */
export function parseUnitTemplate(paragraphs: readonly string[]): ParsedTemplate {
  const warnings: TemplateWarning[] = [];
  const lines = paragraphs
    .flatMap((paragraph) => paragraph.split("\n"))
    .map(cleanLine)
    .filter((line) => line !== "" && !FORM_MARKER_RE.test(line));

  const firstContent = lines.findIndex((line) => HEADING_RE.test(line) || ENTRY_START_RE.test(line));
  const headerLines = firstContent === -1 ? lines : lines.slice(0, firstContent);
  const bodyLines = firstContent === -1 ? [] : lines.slice(firstContent);
  const header = parseHeader(headerLines, warnings);

  const sections: TemplateSection[] = [];
  let entryLines: string[] | null = null;

  const entryWhere = (section: TemplateSection, lines: readonly string[]): string =>
    `bagian ${section.label} (${section.titleId}) › entri ${section.entries.length + 1} (${(lines[0] ?? "").slice(0, 40)})`;

  const flushEntry = (): void => {
    const section = sections[sections.length - 1];
    if (!entryLines || !section) return;
    const entry = buildEntry(entryLines, entryWhere(section, entryLines), warnings);
    if (entry) section.entries.push(entry);
    entryLines = null;
  };

  for (const line of bodyLines) {
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushEntry();
      const position = sections.length + 1;
      sections.push({
        position,
        label: heading[1] ? `${heading[1]}${heading[2] ?? ""}` : String(position),
        titleId: cleanLatin(heading[3] ?? ""),
        patternJp: cleanJapanese(heading[4] ?? ""),
        patternRomaji: cleanLatin(heading[5] ?? ""),
        entries: [],
      });
    } else if (ENTRY_START_RE.test(line)) {
      flushEntry();
      entryLines = [line.replace(ENTRY_START_RE, "")];
    } else if (entryLines) {
      entryLines.push(line);
    } else {
      warnings.push({ where: "isi dokumen", message: `baris di luar entri dilewati: "${line}"` });
    }
  }
  flushEntry();

  for (const section of sections) {
    if (section.entries.length === 0) warnings.push({ where: `bagian ${section.label} (${section.titleId})`, message: "bagian tanpa entri" });
  }
  if (sections.length === 0) warnings.push({ where: "isi dokumen", message: "tidak ada bagian pola yang dikenali (baris seperti 'Nama (～pola ... romaji)')" });

  return { ...header, sections, warnings };
}
