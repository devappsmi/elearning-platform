import { describe, expect, test } from "vitest";
import { describeImport, formatUnitJson, generateUnit, isImportable } from "./unit-import";
import { UNIT_MANIFEST } from "./unit-manifest";
import type { RawUnit } from "./unit-builder";

const SAMPLE: RawUnit = {
  id: "unit_uji",
  order: 1,
  title: "Uji",
  description: "Deskripsi",
  type: "conversation",
  grammar_notes: [{ id: "g1", title: "Judul", body_md: "Baris satu\n  Baris dua", lesson_id: "l1" }],
  vocab: [{ id: "v1", surface: "犬", kana: "いぬ", romaji: "inu", meaning_id: "Anjing", image: null, audio: "" }],
  sentences: [
    {
      id: "s1",
      surface: "犬が走る",
      kana: "いぬがはしる",
      romaji: "inu ga hashiru",
      meaning_id: "Anjing berlari",
      words: [
        { surface: "犬が", kana: "いぬが" },
        { surface: "走る", kana: "はしる" },
      ],
      assemble_tokens: ["犬が", "走る"],
      audio: "",
      voice: "female",
    },
  ],
  lessons: [{ id: "l1", title: "Pelajaran", exercises: [{ type: "choose", ref: "v1" }, { type: "assemble", ref: "s1" }] }],
};

describe("formatUnitJson", () => {
  const json = formatUnitJson(SAMPLE);

  test("hasilnya JSON yang sama persis isinya, berakhir baris baru", () => {
    expect(JSON.parse(json)).toEqual(SAMPLE);
    expect(json.endsWith("}\n")).toBe(true);
  });

  test("deretan nilai sederhana dan objek daun sebaris; objek bersarang diperluas dengan indentasi 2 spasi", () => {
    expect(json).toContain('  "id": "unit_uji",');
    expect(json).toContain('      "assemble_tokens": ["犬が","走る"],');
    expect(json).toContain('        { "surface": "犬が", "kana": "いぬが" },');
    expect(json).toContain('    { "id": "v1", "surface": "犬", "kana": "いぬ", "romaji": "inu", "meaning_id": "Anjing", "image": null, "audio": "" }');
    expect(json).toContain('{ "type": "choose", "ref": "v1" }');
  });

  test("larik kosong dan objek kosong tetap sah", () => {
    expect(JSON.parse(formatUnitJson({ ...SAMPLE, vocab: [], grammar_notes: [] }))).toMatchObject({ vocab: [], grammar_notes: [] });
  });
});

describe("generateUnit + describeImport (sumber Word sungguhan di manifest)", () => {
  const entry = UNIT_MANIFEST.filter(isImportable).find((e) => e.source.unitId === "unit_kerja_3");

  test("ringkasan memuat jumlah isi, perbaikan teks, dan hitungan peringatan", () => {
    expect(entry).toBeDefined();
    const lines = describeImport(generateUnit(entry!));
    expect(lines[0]).toMatch(/^Unit unit_kerja_3 \(Percakapan di Tempat Kerja\): 11 pelajaran, \d+ soal, \d+ kosakata, \d+ kalimat, 11 catatan\.$/);
    expect(lines).toContain("Perbaikan teks sumber (19):");
    expect(lines.some((line) => /Peringatan: 0 belum ditinjau, 3 sudah diterima/.test(line))).toBe(true);
    expect(lines.filter((line) => line.startsWith("  - [diterima] "))).toHaveLength(3);
  });

  test("unit Hiragana (tanpa sumber Word) tidak dianggap bisa diimpor", () => {
    expect(UNIT_MANIFEST.filter((e) => !isImportable(e)).map((e) => e.file)).toContain("raw/unit_hiragana.json");
  });
});
