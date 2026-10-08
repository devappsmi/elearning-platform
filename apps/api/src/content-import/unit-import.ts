import { readFileSync } from "node:fs";
import { readDocxParagraphs } from "./docx-reader";
import { parseUnitTemplate } from "./template-parser";
import { buildUnit, type BuildUnitResult, type ImportOverrides, type RawUnit } from "./unit-builder";
import { seedDataPath, type UnitManifestEntry, type UnitManifestSource } from "./unit-manifest";

/** Impor satu unit dari sumber Word-nya sesuai entri manifest: baca .docx -> urai -> bangun (+ perbaikan/pengganti). Dipakai
 * perintah `unit:import` dan tes sinkronisasi; tidak menyentuh database. */

export type ImportableEntry = UnitManifestEntry & { source: UnitManifestSource };

export function isImportable(entry: UnitManifestEntry): entry is ImportableEntry {
  return entry.source !== undefined;
}

/** Bentuk berkas JSON yang disimpan: indentasi 2 spasi seperti unit lain, tetapi deretan huruf/potongan dan objek daun (satu
 * baris isi) tetap sebaris supaya diff-nya bisa dibaca orang. Akhiri dengan baris baru. */
export function formatUnitJson(unit: RawUnit): string {
  const isPrimitive = (value: unknown): boolean => value === null || typeof value !== "object";
  const render = (value: unknown, depth: number): string => {
    if (isPrimitive(value)) return JSON.stringify(value);
    const pad = "  ".repeat(depth + 1);
    const closePad = "  ".repeat(depth);
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      if (value.every(isPrimitive)) return JSON.stringify(value);
      return `[\n${value.map((item) => pad + render(item, depth + 1)).join(",\n")}\n${closePad}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    if (entries.every(([, v]) => isPrimitive(v))) return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
    return `{\n${entries.map(([k, v]) => `${pad}${JSON.stringify(k)}: ${render(v, depth + 1)}`).join(",\n")}\n${closePad}}`;
  };
  return `${render(unit, 0)}\n`;
}

export function loadOverrides(path: string | undefined): ImportOverrides | undefined {
  if (!path) return undefined;
  return JSON.parse(readFileSync(seedDataPath(path), "utf-8")) as ImportOverrides;
}

export interface GeneratedUnit extends BuildUnitResult {
  /** Isi berkas JSON yang seharusnya tersimpan di `entry.file`. */
  json: string;
}

export function generateUnit(entry: ImportableEntry): GeneratedUnit {
  const { source } = entry;
  const docx = readFileSync(seedDataPath(source.docx));
  const parsed = parseUnitTemplate(readDocxParagraphs(new Uint8Array(docx.buffer, docx.byteOffset, docx.byteLength)));
  const result = buildUnit(parsed, {
    unitId: source.unitId,
    idPrefix: source.idPrefix,
    order: source.order,
    title: source.title,
    description: source.description,
    overrides: loadOverrides(source.overrides),
  });
  return { ...result, json: formatUnitJson(result.raw) };
}

/** Ringkasan untuk dibaca pengimpor: jumlah isi, perbaikan teks yang diterapkan, dan peringatan (tiap satu baris). */
export function describeImport(result: GeneratedUnit): string[] {
  const { raw } = result;
  const exercises = raw.lessons.reduce((total, lesson) => total + lesson.exercises.length, 0);
  const lines = [
    `Unit ${raw.id} (${raw.title}): ${raw.lessons.length} pelajaran, ${exercises} soal, ${raw.vocab.length} kosakata, ${raw.sentences.length} kalimat, ${raw.grammar_notes.length} catatan.`,
  ];
  if (result.appliedFixes.length > 0) {
    lines.push(`Perbaikan teks sumber (${result.appliedFixes.length}):`);
    for (const { fix, count } of result.appliedFixes) lines.push(`  - [${fix.field}] "${fix.from}" -> "${fix.to}" (${count}x): ${fix.why}`);
  }
  const pending = result.warnings.filter((warning) => !warning.accepted);
  const accepted = result.warnings.length - pending.length;
  lines.push(
    result.warnings.length === 0
      ? "Tanpa peringatan."
      : `Peringatan: ${pending.length} belum ditinjau, ${accepted} sudah diterima (overrides.acceptedWarnings). Periksa bahwa sumbernya memang demikian:`,
  );
  for (const warning of result.warnings) lines.push(`  - ${warning.accepted ? "[diterima] " : ""}${warning.where}: ${warning.message}`);
  return lines;
}
