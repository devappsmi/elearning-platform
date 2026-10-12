import { unitSchema, type Unit } from "@elearning/domain";
import { alignReading, readingOfRange, readingText, type ReadingSegment } from "./reading-align";
import { romajiToReading } from "./romaji";
import type { ParsedTemplate, TemplateChain, TemplatePart, TemplateSection, TemplateSentence, TemplateWarning } from "./template-parser";

/** Template konten (hasil `parseUnitTemplate`) -> JSON unit bertipe `conversation` yang dibaca `unitSchema` dan di-seed ke
 * database seperti unit Hiragana (kosakata, kalimat, catatan tata bahasa, pelajaran + latihan).
 *
 * Pemetaan (SATU bagian pola = SATU pelajaran):
 *  - kosakata   = elemen pertama rangkaian tiap entri (kata dasar, mis. 始める = "Mulai") dan rangkaian tambahan
 *  - kalimat    = tiap kalimat bertahap di template (dua bentuk setara "A/B" menjadi dua kalimat dengan arti yang sama);
 *                 `kana` = bacaan dari romaji pengajar; `assemble_tokens` = potongan untuk soal susun-kalimat
 *  - catatan    = satu per bagian: rangkaian bentuk + contoh kalimat penuh (tampil di pelajaran lewat `lesson_id`)
 *  - latihan    = per entri: pilih arti kata dasar -> susun tiap kalimat bertahap (frasa pendek ke kalimat penuh, persis urutan
 *                 template) -> pilih arti kalimat penuh
 *
 * Potongan susun kalimat diturunkan dari template sendiri, bukan ditebak: rangkaian bentuk (mis. 始めている + ところです) dan
 * kalimat bertahap (tiap langkah memuat langkah sebelumnya + satu tambahan) sudah membatasi potongannya. Yang tak bisa
 * diturunkan jatuh ke pemecahan sederhana dan DILAPORKAN; pengganti manual lewat `overrides` (dapat diulang, bukan sunting JSON). */

export interface TextFix {
  field: "jp" | "romaji" | "id";
  from: string;
  to: string;
  /** Alasan perbaikan -- ikut dilaporkan supaya pemilik konten bisa memeriksa. */
  why: string;
}

export interface ImportOverrides {
  /** Perbaikan salah ketik di sumber, diterapkan pada hasil urai SEBELUM apa pun dibangun. Tiap perbaikan harus terpakai. */
  textFixes?: TextFix[];
  /** Potongan susun-kalimat pengganti. Kunci = tulisan Jepang kalimat (dengan tanda baca); gabungan potongan harus persis kalimatnya. */
  tokens?: Record<string, string[]>;
  /** Bacaan pengganti untuk satu deretan kanji (mis. 続 -> つづ: romaji tidak membedakan ず dan づ). */
  runReadings?: Record<string, string>;
  /** Peringatan yang sudah ditinjau dan memang demikian adanya di sumber (mis. template menulis satu bentuk saja). Peringatan
   * yang cocok (`contains` termuat di "<bagian>: <pesan>") ditandai `accepted`; yang tak cocok apa pun dilaporkan lagi. */
  acceptedWarnings?: { contains: string; why: string }[];
}

export interface BuildUnitOptions {
  /** Id unit di database, mis. "unit_kerja_3". */
  unitId: string;
  /** Awalan id kosakata/kalimat/pelajaran/catatan, mis. "k3" -> "k3v_hajimeru", "k3s_1_1_1", "k3_l1". Harus unik antarunit. */
  idPrefix: string;
  order: number;
  title?: string;
  description?: string;
  overrides?: ImportOverrides;
}

export interface RawVocab {
  id: string;
  surface: string;
  kana: string;
  romaji: string;
  meaning_id: string | null;
  image: null;
  audio: string;
}

export interface RawSentence {
  id: string;
  surface: string;
  kana: string;
  romaji: string;
  meaning_id: string;
  words: { surface: string; kana: string }[];
  assemble_tokens: string[];
  audio: string;
  voice: "female";
}

export interface RawExercise {
  type: "choose" | "assemble";
  ref: string;
}

export interface RawUnit {
  id: string;
  order: number;
  title: string;
  description: string;
  type: "conversation";
  grammar_notes: { id: string; title: string; body_md: string; lesson_id: string }[];
  vocab: RawVocab[];
  sentences: RawSentence[];
  lessons: { id: string; title: string; exercises: RawExercise[] }[];
}

export interface BuildUnitResult {
  /** JSON siap simpan (bentuk berkas seed, snake_case). */
  raw: RawUnit;
  /** `raw` setelah lolos `unitSchema` (bentuk camelCase yang dipakai aplikasi). */
  unit: Unit;
  /** Semua peringatan; yang `accepted` sudah ditinjau (overrides.acceptedWarnings), sisanya menunggu peninjauan. */
  warnings: TemplateWarning[];
  /** Perbaikan teks yang benar-benar diterapkan (jumlah kemunculan). */
  appliedFixes: { fix: TextFix; count: number }[];
}

// ---------------------------------------------------------------------------------------------------------------------
// Teks: ekor kalimat, alternatif "A/B", rangkaian bentuk
// ---------------------------------------------------------------------------------------------------------------------

const TAIL_RE = /[。！？!?．.…]+$/;
const ALTERNATIVE_SEPARATOR_RE = /\s*[/／]\s*/;
// Potongan rangkaian yang lebih pendek dari ini (satu huruf) menempel ke potongan sebelumnya; dua huruf (です, いる, から) boleh berdiri sendiri.
const MIN_PIECE_LENGTH = 2;
// Sisa kiri yang sepanjang ini atau lebih dipecah lagi di partikel (mergePieces), supaya tak ada kepingan terlalu panjang.
const LONG_LEFTOVER_LENGTH = 8;

function splitTail(text: string): { core: string; tail: string } {
  const match = TAIL_RE.exec(text);
  return match ? { core: text.slice(0, match.index), tail: match[0] } : { core: text, tail: "" };
}

/** Bentuk ke-`altIndex` dari teks yang memuat alternatif "A/B"; tanpa alternatif (atau tak punya bentuk itu) = bentuk pertama. */
function alternativeOf(text: string, altIndex: number): string {
  const alts = text.split(ALTERNATIVE_SEPARATOR_RE).filter((alt) => alt !== "");
  return alts[altIndex] ?? alts[0] ?? text;
}

/** Potongan susun dari rangkaian bentuk. Dipakai deretan TERPANJANG di ujung rangkaian yang tiap bagiannya diawali bagian
 * sebelumnya (始めている -> 始めているところです: [始めている][ところです]). Selisih satu huruf ditempelkan ke potongan sebelumnya,
 * dan partikel を di awal potongan dikembalikan ke kata benda di depannya (風邪 + を引いた -> 風邪を + 引いた). */
function chainPieces(parts: readonly string[]): string[] {
  const jp = parts.filter((part) => part !== "");
  if (jp.length === 0) return [];
  let start = jp.length - 1;
  while (start > 0 && (jp[start] as string).startsWith(jp[start - 1] as string)) start--;
  const raw = [jp[start] as string];
  for (let i = start + 1; i < jp.length; i++) raw.push((jp[i] as string).slice((jp[i - 1] as string).length));
  const pieces: string[] = [];
  for (let piece of raw) {
    if (pieces.length > 0 && piece.length > 1 && piece.startsWith("を")) {
      pieces[pieces.length - 1] += "を";
      piece = piece.slice(1);
    }
    if (pieces.length > 0 && piece.length < MIN_PIECE_LENGTH) pieces[pieces.length - 1] += piece;
    else pieces.push(piece);
  }
  return pieces;
}

// ---------------------------------------------------------------------------------------------------------------------
// Potongan susun kalimat
// ---------------------------------------------------------------------------------------------------------------------

/** Frasa yang potongannya sudah diketahui: bagian akhir rangkaian bentuk atau langkah kalimat sebelumnya. */
interface Known {
  core: string;
  tokens: string[];
}

type Piece = { known: true; tokens: string[] } | { known: false; text: string };

/** Bagi `segment` di sekitar frasa dikenal terpanjang yang termuat di dalamnya; sisa kiri/kanan diproses dengan frasa lain,
 * dan yang tak termuat frasa mana pun menjadi satu potongan "sisa". */
function coverSegment(segment: string, known: readonly Known[]): Piece[] {
  if (segment === "") return [];
  let best: Known | undefined;
  let bestIndex = -1;
  for (const candidate of known) {
    if (candidate.core.length < 2) continue;
    const index = segment.indexOf(candidate.core);
    if (index !== -1 && (best === undefined || candidate.core.length > best.core.length)) {
      best = candidate;
      bestIndex = index;
    }
  }
  if (!best) return [{ known: false, text: segment }];
  const rest = known.filter((candidate) => candidate !== best);
  return [
    ...coverSegment(segment.slice(0, bestIndex), rest),
    { known: true, tokens: best.tokens },
    ...coverSegment(segment.slice(bestIndex + best.core.length), rest),
  ];
}

const LEADING_PUNCTUATION_RE = /^[、。，．！？!?,.]+/;
const PUNCTUATION_ONLY_RE = /^[、。，．！？!?,.\s]+$/;
// Satu huruf kana (kemungkinan besar partikel: は, が, の, ...). Satu huruf kanji (夜, 朝) tetap berdiri sendiri.
const SINGLE_PARTICLE_RE = /^[\u3041-\u309f\u30a1-\u30ff]$/;

/** Potongan "sisa" yang cuma tanda baca atau satu huruf kana (partikel) menempel ke tetangganya, bukan jadi kepingan sendiri. */
function mergePieces(pieces: readonly Piece[]): string[] {
  const out: string[] = [];
  let pending = "";
  for (const piece of pieces) {
    if (piece.known) {
      for (const token of piece.tokens) {
        out.push(pending + token);
        pending = "";
      }
      continue;
    }
    let text = pending + piece.text;
    pending = "";
    const lead = LEADING_PUNCTUATION_RE.exec(text)?.[0] ?? "";
    if (lead && out.length > 0) {
      out[out.length - 1] += lead;
      text = text.slice(lead.length);
    }
    if (text === "") continue;
    if (SINGLE_PARTICLE_RE.test(text) || PUNCTUATION_ONLY_RE.test(text)) {
      if (out.length > 0) out[out.length - 1] += text;
      else pending = text;
      continue;
    }
    if (text.length >= LONG_LEFTOVER_LENGTH) out.push(...particleSplit(text));
    else out.push(text);
  }
  if (pending) {
    if (out.length > 0) out[out.length - 1] += pending;
    else out.push(pending);
  }
  return out;
}

const PARTICLES = ["までに", "から", "まで", "には", "では", "とは", "より", "は", "が", "を", "に", "で", "と", "も", "へ", "の"];
const NOUN_END_RE = /[\u3400-\u9fff\u30a0-\u30ff々]$/;

/** Potong sesudah koma dan sesudah partikel yang mengikuti kanji/katakana. Dipakai untuk sisa kiri yang panjang dan, sebagai
 * cadangan, untuk kalimat yang tak memuat frasa dikenal sama sekali. */
function particleSplit(text: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let i = 0;
  while (i < text.length) {
    const particle = NOUN_END_RE.test(current) ? PARTICLES.find((candidate) => text.startsWith(candidate, i)) : undefined;
    if (particle && i + particle.length < text.length) {
      tokens.push(current + particle);
      current = "";
      i += particle.length;
      continue;
    }
    const char = text[i] as string;
    current += char;
    i += 1;
    if (char === "、") {
      tokens.push(current);
      current = "";
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

interface StepTokens {
  /** Potongan lengkap kalimat (tanda baca penutup menempel di potongan terakhir). */
  tokens: string[];
  /** Potongan tanpa tanda baca penutup -- dipakai kalimat berikutnya yang memuat langkah ini. */
  coreTokens: string[];
  method: "override" | "known" | "fallback";
}

function tokenizeStep(text: string, known: readonly Known[], override: readonly string[] | undefined): StepTokens {
  const { core, tail } = splitTail(text);
  if (override) {
    const coreTokens = [...override];
    const last = coreTokens.length - 1;
    if (tail && last >= 0 && (coreTokens[last] as string).endsWith(tail)) coreTokens[last] = (coreTokens[last] as string).slice(0, -tail.length);
    return { tokens: [...override], coreTokens, method: "override" };
  }
  const pieces = coverSegment(core, known);
  const usedKnown = pieces.some((piece) => piece.known);
  const coreTokens = mergePieces(usedKnown ? pieces : particleSplit(core).map((token): Piece => ({ known: false, text: token })));
  const tokens = [...coreTokens];
  if (tail) {
    if (tokens.length > 0) tokens[tokens.length - 1] += tail;
    else tokens.push(tail);
  }
  return { tokens, coreTokens, method: usedKnown ? "known" : "fallback" };
}

// ---------------------------------------------------------------------------------------------------------------------
// Perbaikan teks sumber
// ---------------------------------------------------------------------------------------------------------------------

function applyTextFixes(template: ParsedTemplate, fixes: readonly TextFix[]): { template: ParsedTemplate; applied: { fix: TextFix; count: number }[] } {
  const clone = structuredClone(template);
  const applied: { fix: TextFix; count: number }[] = [];
  for (const fix of fixes) {
    let count = 0;
    const replace = (text: string): string => {
      const parts = text.split(fix.from);
      count += parts.length - 1;
      return parts.join(fix.to);
    };
    for (const section of clone.sections) {
      for (const entry of section.entries) {
        for (const block of [entry.head, ...entry.blocks]) {
          if (block.kind === "chain") {
            for (const part of block.parts) part[fix.field] = replace(part[fix.field]);
          } else if (fix.field === "id") {
            block.id = replace(block.id);
          } else {
            for (const alt of block.alts) alt[fix.field] = replace(alt[fix.field]);
          }
        }
      }
    }
    applied.push({ fix, count });
  }
  return { template: clone, applied };
}

// ---------------------------------------------------------------------------------------------------------------------
// Bacaan
// ---------------------------------------------------------------------------------------------------------------------

function alignWithOverrides(jp: string, romaji: string, runReadings: Readonly<Record<string, string>>): ReadingSegment[] | null {
  const segments = alignReading(jp, romajiToReading(romaji));
  if (!segments) return null;
  return segments.map((segment) => {
    const override = segment.kind === "kanji" ? runReadings[segment.jp] : undefined;
    return override === undefined ? segment : { ...segment, reading: override };
  });
}

function slugOf(romaji: string): string {
  return romaji
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ---------------------------------------------------------------------------------------------------------------------
// Pembangun
// ---------------------------------------------------------------------------------------------------------------------

function chainLine(chain: TemplateChain, field: "jp" | "id"): string {
  return chain.parts.map((part) => part[field] || "…").join(" → ");
}

function sentenceLine(sentence: TemplateSentence, text: "jp" | "id"): string {
  return text === "jp" ? sentence.alts.map((alt) => alt.jp).join(" / ") : sentence.id;
}

function buildGrammarNote(section: TemplateSection, lessonId: string, noteId: string): RawUnit["grammar_notes"][number] {
  const lines: string[] = [`Pola: ${section.patternJp}${section.patternRomaji ? ` (${section.patternRomaji})` : ""}`, ""];
  lines.push("Rangkaian bentuk:");
  for (const entry of section.entries) {
    for (const block of [entry.head, ...entry.blocks]) {
      if (block.kind !== "chain") continue;
      lines.push(`- ${chainLine(block, "jp")}`, `  ${chainLine(block, "id")}`);
    }
  }
  lines.push("", "Contoh kalimat:");
  for (const entry of section.entries) {
    const last = [...entry.blocks].reverse().find((block): block is TemplateSentence => block.kind === "sentence");
    if (last) lines.push(`- ${sentenceLine(last, "jp")}`, `  ${sentenceLine(last, "id")}`);
  }
  return { id: noteId, title: `${section.titleId} (${section.patternJp})`, body_md: lines.join("\n"), lesson_id: lessonId };
}

export function buildUnit(parsed: ParsedTemplate, options: BuildUnitOptions): BuildUnitResult {
  const overrides = options.overrides ?? {};
  const runReadings = overrides.runReadings ?? {};
  const tokenOverrides = overrides.tokens ?? {};
  const warnings: TemplateWarning[] = [...parsed.warnings];
  const { template, applied: appliedFixes } = applyTextFixes(parsed, overrides.textFixes ?? []);
  for (const { fix, count } of appliedFixes) {
    if (count === 0) warnings.push({ where: "perbaikan teks", message: `perbaikan tidak terpakai (teks "${fix.from}" tidak ditemukan di ${fix.field}): ${fix.why}` });
  }
  const unusedTokenOverrides = new Set(Object.keys(tokenOverrides));

  const vocab: RawVocab[] = [];
  const vocabBySurface = new Map<string, string>();
  const usedVocabIds = new Set<string>();
  const sentences: RawSentence[] = [];
  const lessons: RawUnit["lessons"] = [];
  const grammarNotes: RawUnit["grammar_notes"] = [];

  const registerVocab = (part: TemplatePart, where: string): string | null => {
    if (part.jp === "") return null;
    const existing = vocabBySurface.get(part.jp);
    if (existing) return existing;
    const slug = slugOf(part.romaji) || `x${vocab.length + 1}`;
    let id = `${options.idPrefix}v_${slug}`;
    for (let n = 2; usedVocabIds.has(id); n++) id = `${options.idPrefix}v_${slug}_${n}`;
    usedVocabIds.add(id);
    const segments = alignWithOverrides(part.jp, part.romaji, runReadings);
    if (!segments) warnings.push({ where, message: `romaji "${part.romaji}" tidak cocok dengan "${part.jp}" (bacaan kosakata tidak bisa diturunkan; dipakai tulisan aslinya)` });
    if (part.id === "") warnings.push({ where, message: `kosakata "${part.jp}" tanpa arti (tidak dibuatkan soal)` });
    vocab.push({
      id,
      surface: part.jp,
      kana: segments ? readingText(segments) : part.jp,
      romaji: part.romaji.toLowerCase(),
      meaning_id: part.id === "" ? null : part.id,
      image: null,
      audio: "",
    });
    vocabBySurface.set(part.jp, id);
    return id;
  };

  for (const section of template.sections) {
    const lessonId = `${options.idPrefix}_l${section.position}`;
    const exercises: RawExercise[] = [];

    section.entries.forEach((entry, entryIndex) => {
      const where = `bagian ${section.label} (${section.titleId}) › entri ${entryIndex + 1}`;

      // Kalimat dobel berurutan (salin-tempel di template) dibuang.
      const blocks = entry.blocks.filter((block, index) => {
        if (block.kind !== "sentence") return true;
        const before = entry.blocks[index - 1];
        const duplicate = before?.kind === "sentence" && before.alts.map((alt) => alt.jp).join("/") === block.alts.map((alt) => alt.jp).join("/");
        if (duplicate) warnings.push({ where, message: `kalimat ganda berurutan dilewati: ${block.alts.map((alt) => alt.jp).join(" / ")}` });
        return !duplicate;
      });
      const ordered = [entry.head, ...blocks];
      const altCount = Math.max(1, ...blocks.map((block) => (block.kind === "sentence" ? block.alts.length : 1)));

      // Token per (blok, bentuk): satu putaran per bentuk alternatif, supaya "A/B" masing-masing punya riwayat langkahnya sendiri.
      const stepTokens = new Map<string, StepTokens>();
      for (let altIndex = 0; altIndex < altCount; altIndex++) {
        const known: Known[] = [];
        ordered.forEach((block, blockIndex) => {
          if (block.kind === "chain") {
            const parts = block.parts.map((part) => alternativeOf(part.jp, altIndex));
            const last = parts[parts.length - 1];
            if (last) known.push({ core: splitTail(last).core, tokens: chainPieces(parts) });
            return;
          }
          // Blok yang tak punya bentuk ke-`altIndex` (template cuma menulis satu bentuk) tidak ikut putaran ini.
          const alt = block.alts[altIndex];
          if (!alt) return;
          const step = tokenizeStep(alt.jp, known, tokenOverrides[alt.jp]);
          unusedTokenOverrides.delete(alt.jp);
          stepTokens.set(`${blockIndex}:${altIndex}`, step);
          if (step.method === "fallback") warnings.push({ where, message: `potongan susun "${alt.jp}" tidak bisa diturunkan dari rangkaian/langkah sebelumnya (dipecah di partikel; periksa)` });
          if (step.coreTokens.length > 0) known.push({ core: splitTail(alt.jp).core, tokens: step.coreTokens });
        });
      }

      // Soal entri ini, berurutan seperti template.
      const baseVocabId = registerVocab(entry.head.parts[0] ?? { jp: "", romaji: "", id: "" }, where);
      const baseVocab = vocab.find((item) => item.id === baseVocabId);
      if (baseVocab?.meaning_id) exercises.push({ type: "choose", ref: baseVocab.id });

      let lastSentenceId: string | undefined;
      let stepNumber = 0;
      ordered.forEach((block, blockIndex) => {
        if (block === entry.head) return;
        if (block.kind === "chain") {
          const auxId = registerVocab(block.parts[0] ?? { jp: "", romaji: "", id: "" }, where);
          const aux = vocab.find((item) => item.id === auxId);
          if (aux?.meaning_id) exercises.push({ type: "choose", ref: aux.id });
          return;
        }
        stepNumber += 1;
        block.alts.forEach((alt, altIndex) => {
          const step = stepTokens.get(`${blockIndex}:${altIndex}`);
          if (!step) return;
          const surface = alt.jp;
          if (step.tokens.join("") !== surface) {
            throw new Error(`${where}: potongan "${step.tokens.join("|")}" tidak membentuk kalimat "${surface}" (periksa overrides.tokens)`);
          }
          const segments = alignWithOverrides(surface, alt.romaji, runReadings);
          if (!segments) warnings.push({ where, message: `romaji "${alt.romaji}" tidak cocok dengan "${surface}" (bacaan kalimat tidak bisa diturunkan; dipakai tulisan aslinya)` });
          let offset = 0;
          // Bacaan per potongan: bila batas potongan memotong satu deretan kanji (毎日|残業) bacaannya tak bisa dibelah tanpa kamus,
          // jadi `kana` potongan itu memakai tulisannya sendiri. (`words` hanya cadangan susun-kalimat, tidak ditampilkan.)
          const words = step.tokens.map((token) => {
            const reading = segments ? readingOfRange(segments, offset, offset + token.length) : null;
            offset += token.length;
            return { surface: token, kana: reading ?? token };
          });
          const id = `${options.idPrefix}s_${section.position}_${entryIndex + 1}_${stepNumber}${block.alts.length > 1 ? `_${String.fromCharCode(97 + altIndex)}` : ""}`;
          sentences.push({
            id,
            surface,
            kana: segments ? readingText(segments) : surface,
            romaji: alt.romaji.toLowerCase(),
            meaning_id: block.id,
            words,
            assemble_tokens: step.tokens,
            audio: "",
            voice: "female",
          });
          if (step.tokens.length >= 2) exercises.push({ type: "assemble", ref: id });
          else warnings.push({ where, message: `kalimat "${surface}" cuma satu potongan: tidak dibuatkan soal susun-kalimat` });
          if (altIndex === 0) lastSentenceId = id;
        });
      });
      if (lastSentenceId) exercises.push({ type: "choose", ref: lastSentenceId });
      else warnings.push({ where, message: "entri tanpa kalimat" });
    });

    lessons.push({ id: lessonId, title: `${section.titleId} (${section.patternJp})`, exercises });
    grammarNotes.push(buildGrammarNote(section, lessonId, `${lessonId}_g`));
  }

  for (const surface of unusedTokenOverrides) warnings.push({ where: "overrides.tokens", message: `pengganti potongan tidak terpakai (kalimat tidak ada di template): ${surface}` });

  const raw: RawUnit = {
    id: options.unitId,
    order: options.order,
    title: options.title ?? parsed.courseTitleId,
    description:
      options.description ??
      `Unit ${parsed.unitNumber ?? "?"}${parsed.levelLabel ? ` · ${parsed.levelLabel}` : ""} — ${template.sections.length} pola kalimat untuk percakapan di tempat kerja.`,
    type: "conversation",
    grammar_notes: grammarNotes,
    vocab,
    sentences,
    lessons,
  };

  return { raw, unit: unitSchema.parse(raw), warnings: markAcceptedWarnings(warnings, overrides.acceptedWarnings ?? []), appliedFixes };
}

function markAcceptedWarnings(warnings: readonly TemplateWarning[], acceptances: readonly { contains: string; why: string }[]): TemplateWarning[] {
  const used = new Set<number>();
  const marked = warnings.map((warning): TemplateWarning => {
    const index = acceptances.findIndex((acceptance) => `${warning.where}: ${warning.message}`.includes(acceptance.contains));
    if (index === -1) return warning;
    used.add(index);
    return { ...warning, accepted: true };
  });
  acceptances.forEach((acceptance, index) => {
    if (!used.has(index)) marked.push({ where: "overrides.acceptedWarnings", message: `penerimaan peringatan tidak terpakai (tak ada peringatan memuat "${acceptance.contains}"): ${acceptance.why}` });
  });
  return marked;
}
