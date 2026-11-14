import { describe, expect, test } from "vitest";
import { parseUnitTemplate } from "./template-parser";

const HEADER = ["Percakapan di Tempat Kerja（職場での会話 Shokuba de no kaiwa）\nN4–N3", "Unit 3"];

/** Satu entri berformat template: baris romaji / Jepang / Indonesia. */
const triple = (romaji: string, jp: string, id: string): string[] => [romaji, jp, id];

const SECTION_1 = [
  "Keadaan Sedang Berlangsung (～ている ... te iru )",
  "① ・ Hajimeru – Hajimete iru – Hajimete iru tokoro desu",
  "\t\t始める –\u3000始めている – 始めているところです",
  "\t\tMulai – Sedang mulai – Baru saja (sedang) mulai",
  ...triple("Kaigi ga hajimete iru tokoro desu", "会議が始めているところです", "Rapatnya baru saja mulai"),
  ...triple("Choudo ima, kaigi ga hajimete iru tokoro desu.", "ちょうど今、会議が始めているところです。", "Tepat sekarang, rapatnya baru saja mulai."),
  "② ・ Furu – Futte iru – Futte iru you desu/Futte iru mitai desu",
  "降る – 降っている – 降っているようです/降っているみたいです",
  "Turun – Sedang turun – Rupanya/Sepertinya sedang turun",
  ...triple("Ame ga futte iru you desu/Ame ga futte iru mitai desu", "雨が降っているようです/雨が降っているみたいです", "Rupanya/Sepertinya sedang turun hujan"),
];

const SECTION_2 = [
  "10a. Konon katanya (～らしい ... rashii )",
  "① ・ Kekkon suru – Kekkon suru rashii",
  "結婚する – 結婚するらしい",
  "Menikah – Konon katanya menikah",
  ...triple("Raigetsu kekkon suru rashii", "来月結婚するらしい", "Konon katanya menikah bulan depan"),
];

describe("parseUnitTemplate: judul dokumen", () => {
  test("judul kursus (Indonesia, Jepang, romaji), tingkat, dan nomor unit", () => {
    const parsed = parseUnitTemplate([...HEADER, ...SECTION_1]);
    expect(parsed).toMatchObject({
      courseTitleId: "Percakapan di Tempat Kerja",
      courseTitleJp: "職場での会話",
      courseTitleRomaji: "Shokuba de no kaiwa",
      levelLabel: "N4–N3",
      unitNumber: 3,
    });
  });

  test("judul tanpa romaji dan tingkat satu: tetap terbaca", () => {
    const parsed = parseUnitTemplate(["Di Restoran（レストランで）", "N5", "Unit 1", ...SECTION_2]);
    expect(parsed).toMatchObject({ courseTitleId: "Di Restoran", courseTitleJp: "レストランで", courseTitleRomaji: "", levelLabel: "N5", unitNumber: 1 });
  });

  test("baris judul yang tak dikenal dilaporkan, bukan membuat gagal", () => {
    const parsed = parseUnitTemplate([...HEADER, "catatan pengajar: draf", ...SECTION_2]);
    expect(parsed.warnings).toEqual([{ where: "judul dokumen", message: 'baris tidak dikenali dan dilewati: "catatan pengajar: draf"' }]);
  });
});

describe("parseUnitTemplate: bagian dan entri", () => {
  const parsed = parseUnitTemplate([...HEADER, ...SECTION_1, ...SECTION_2, "Top of Form"]);

  test("bagian: nomor otomatis berurutan, nomor tertulis (10a) dipakai apa adanya, pola dan romaji terpisah", () => {
    expect(parsed.sections.map((s) => [s.position, s.label, s.titleId, s.patternJp, s.patternRomaji])).toEqual([
      [1, "1", "Keadaan Sedang Berlangsung", "～ている", "te iru"],
      [2, "10a", "Konon katanya", "～らしい", "rashii"],
    ]);
  });

  test("entri diawali ・ (boleh didahului angka lingkaran); rangkaian pembuka dalam tiga bahasa, spasi lebar dibuang", () => {
    const entry = parsed.sections[0]?.entries[0];
    expect(entry?.head).toEqual({
      kind: "chain",
      parts: [
        { romaji: "Hajimeru", jp: "始める", id: "Mulai" },
        { romaji: "Hajimete iru", jp: "始めている", id: "Sedang mulai" },
        { romaji: "Hajimete iru tokoro desu", jp: "始めているところです", id: "Baru saja (sedang) mulai" },
      ],
    });
    expect(parsed.sections[0]?.entries).toHaveLength(2);
    expect(parsed.sections[1]?.entries).toHaveLength(1);
  });

  test("kalimat bertahap: tiga baris per blok, dibaca berurutan", () => {
    const blocks = parsed.sections[0]?.entries[0]?.blocks;
    expect(blocks).toEqual([
      { kind: "sentence", alts: [{ jp: "会議が始めているところです", romaji: "Kaigi ga hajimete iru tokoro desu" }], id: "Rapatnya baru saja mulai" },
      {
        kind: "sentence",
        alts: [{ jp: "ちょうど今、会議が始めているところです。", romaji: "Choudo ima, kaigi ga hajimete iru tokoro desu." }],
        id: "Tepat sekarang, rapatnya baru saja mulai.",
      },
    ]);
  });

  test('dua bentuk setara dipisah "/" menjadi dua alternatif (Jepang dan romaji berpasangan); terjemahan tetap satu', () => {
    const sentence = parsed.sections[0]?.entries[1]?.blocks[0];
    expect(sentence).toEqual({
      kind: "sentence",
      alts: [
        { jp: "雨が降っているようです", romaji: "Ame ga futte iru you desu" },
        { jp: "雨が降っているみたいです", romaji: "Ame ga futte iru mitai desu" },
      ],
      id: "Rupanya/Sepertinya sedang turun hujan",
    });
    // "A/B" di rangkaian pembuka tetap satu teks (dipecah oleh pembangun unit per bentuk).
    expect(parsed.sections[0]?.entries[1]?.head.parts[2]?.jp).toBe("降っているようです/降っているみたいです");
  });

  test("blok yang romaji/Jepang-nya berisi pemisah ' – ' adalah rangkaian tambahan, bukan kalimat", () => {
    const aux = ["① ・ Kenkou suru – Kenkou shite", "健康する – 健康して", "Sehat – Sehat dan", "Kenkou – Kenkou no tame ni", "健康 – 健康のために", "Kesehatan – Demi kesehatan", ...triple("Kenkou no tame ni", "健康のために", "Demi kesehatan")];
    const entry = parseUnitTemplate([...HEADER, "Pola (～ため ... tame )", ...aux]).sections[0]?.entries[0];
    expect(entry?.blocks.map((b) => b.kind)).toEqual(["chain", "sentence"]);
    expect(entry?.blocks[0]).toMatchObject({ kind: "chain", parts: [{ jp: "健康" }, { jp: "健康のために" }] });
  });

  test("hubung berspasi memisahkan rangkaian, hubung dalam kata tidak ('laki-laki')", () => {
    const lines = ["① ・ Otoko - Otoko rashii", "男 - 男らしい", "Laki-laki - Layak sebagai laki-laki"];
    const entry = parseUnitTemplate([...HEADER, "Pola (～らしい ... rashii )", ...lines]).sections[0]?.entries[0];
    expect(entry?.head.parts.map((p) => p.id)).toEqual(["Laki-laki", "Layak sebagai laki-laki"]);
  });

  test("huruf Latin lebar-penuh dan tanda baca lebar dibakukan di romaji/Indonesia; tulisan Jepang tidak diubah", () => {
    const lines = ["① ・ Suru – Suru koto", "する – すること", "ｄitentukan – ｄitentukan．", ...triple("Kore．", "これ。", "Ini．")];
    const entry = parseUnitTemplate([...HEADER, "Pola (～こと ... koto )", ...lines]).sections[0]?.entries[0];
    expect(entry?.head.parts[0]?.id).toBe("ditentukan");
    expect(entry?.blocks[0]).toMatchObject({ alts: [{ jp: "これ。", romaji: "Kore." }], id: "Ini." });
  });
});

describe("parseUnitTemplate: peringatan (tidak menebak)", () => {
  test("rangkaian yang tak sama panjang di tiga baris: bagian yang kurang dikosongkan dan dilaporkan", () => {
    const lines = ["① ・ Sekininkan – Sekininkan ga tsuyoi – Sekininkan ga tsuyokute", "責任感 – 責任感が強い – 責任感が強くて", "Rasa tanggung jawab – Rasa tanggung jawabnya kuat"];
    const parsed = parseUnitTemplate([...HEADER, "Pola (～らしい ... rashii )", ...lines]);
    expect(parsed.sections[0]?.entries[0]?.head.parts.map((p) => p.id)).toEqual(["Rasa tanggung jawab", "Rasa tanggung jawabnya kuat", ""]);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]?.message).toMatch(/tidak sama panjang.*romaji 3, Jepang 3, Indonesia 2/);
    expect(parsed.warnings[0]?.where).toMatch(/bagian 1 \(Pola\) › entri 1/);
  });

  test("jumlah bentuk 'A/B' beda antara romaji dan tulisan Jepang: dipasangkan menurut urutan, dilaporkan", () => {
    const lines = ["① ・ Karai – Karai you desu", "辛い – 辛いようです", "Pedas – Rupanya pedas", ...triple("Karai you desu./Karai mitai desu.", "辛いようです。", "Rupanya pedas.")];
    const parsed = parseUnitTemplate([...HEADER, "Pola (～よう ... you )", ...lines]);
    expect(parsed.sections[0]?.entries[0]?.blocks[0]).toMatchObject({ alts: [{ jp: "辛いようです。", romaji: "Karai you desu." }] });
    expect(parsed.warnings.map((w) => w.message)).toEqual([expect.stringMatching(/2 bentuk di romaji tetapi 1 di tulisan Jepang/)]);
  });

  test("baris yang merusak pola tiga-tiga dilewati dan dilaporkan; sisa entri tetap terbaca (resinkronisasi)", () => {
    const lines = [
      "① ・ Hajimeru – Hajimete iru",
      "始める – 始めている",
      "Mulai – Sedang mulai",
      "baris nyasar tanpa tulisan Jepang",
      ...triple("Kaigi ga hajimete iru", "会議が始めている", "Rapat sedang mulai"),
    ];
    const parsed = parseUnitTemplate([...HEADER, "Pola (～ている ... te iru )", ...lines]);
    expect(parsed.sections[0]?.entries[0]?.blocks).toHaveLength(1);
    expect(parsed.warnings.map((w) => w.message)).toEqual(['baris dilewati karena tidak membentuk kelompok romaji / Jepang / Indonesia: "baris nyasar tanpa tulisan Jepang"']);
  });

  test("baris di luar entri (sebelum ・ pertama sebuah bagian) dan bagian tanpa entri dilaporkan", () => {
    const parsed = parseUnitTemplate([...HEADER, "Pola A (～a ... a )", "teks bebas", "Pola B (～b ... b )"]);
    expect(parsed.warnings.map((w) => w.message)).toEqual(['baris di luar entri dilewati: "teks bebas"', "bagian tanpa entri", "bagian tanpa entri"]);
  });

  test("dokumen tanpa bagian pola dilaporkan", () => {
    expect(parseUnitTemplate(HEADER).warnings.map((w) => w.message)).toEqual([expect.stringMatching(/tidak ada bagian pola/)]);
  });

  test("baris kosong dan penanda formulir Word ('Top of Form') diabaikan tanpa peringatan", () => {
    const parsed = parseUnitTemplate([...HEADER, "", "   ", ...SECTION_2, "Top of Form", ""]);
    expect(parsed.warnings).toEqual([]);
  });
});
