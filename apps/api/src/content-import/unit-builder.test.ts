import { ExerciseFactory, unitSchema } from "@elearning/domain";
import { describe, expect, test } from "vitest";
import { buildUnit, type BuildUnitOptions, type ImportOverrides } from "./unit-builder";
import { parseUnitTemplate } from "./template-parser";

const triple = (romaji: string, jp: string, id: string): string[] => [romaji, jp, id];

const TEMPLATE = [
  "Percakapan di Tempat Kerja（職場での会話 Shokuba de no kaiwa）\nN4–N3",
  "Unit 3",
  "Keadaan Sedang Berlangsung (～ている ... te iru )",
  "① ・ Hajimeru – Hajimete iru – Hajimete iru tokoro desu",
  "始める – 始めている – 始めているところです",
  "Mulai – Sedang mulai – Baru saja (sedang) mulai",
  ...triple("Kaigi ga hajimete iru tokoro desu", "会議が始めているところです", "Rapatnya baru saja mulai"),
  ...triple("Choudo ima, kaigi ga hajimete iru tokoro desu.", "ちょうど今、会議が始めているところです。", "Tepat sekarang, rapatnya baru saja mulai."),
  "② ・ Furu – Futte iru – Futte iru you desu/Futte iru mitai desu",
  "降る – 降っている – 降っているようです/降っているみたいです",
  "Turun – Sedang turun – Rupanya/Sepertinya sedang turun",
  ...triple("Ame ga futte iru you desu/Ame ga futte iru mitai desu", "雨が降っているようです/雨が降っているみたいです", "Rupanya/Sepertinya sedang turun hujan"),
  ...triple("Soto wa ame ga futte iru you desu./Soto wa ame ga futte iru mitai desu.", "外は雨が降っているようです。/外は雨が降っているみたいです。", "Di luar rupanya/sepertinya sedang turun hujan."),
  "Membiasakan diri (～ようにしている ... you ni site iru )",
  "① ・ Taberu – Taberu you ni – Taberu you ni shite imasu",
  "食べる – 食べるように – 食べるようにしています",
  "Makan – Agar makan – Membiasakan makan",
  ...triple("Yasai o taberu you ni shite imasu", "野菜を食べるようにしています", "Membiasakan makan sayur"),
  // Rangkaian tambahan (kata bantu untuk langkah berikutnya).
  "Kenkou – Kenkou no tame ni",
  "健康 – 健康のために",
  "Kesehatan – Demi kesehatan",
  ...triple("Kenkou no tame ni, yasai o taberu you ni shite imasu.", "健康のために、野菜を食べるようにしています。", "Demi kesehatan, saya membiasakan makan sayur."),
  // Salinan ganda berurutan di template: dibuang.
  ...triple("Kenkou no tame ni, yasai o taberu you ni shite imasu.", "健康のために、野菜を食べるようにしています。", "Demi kesehatan, saya membiasakan makan sayur."),
];

const OPTIONS: BuildUnitOptions = { unitId: "unit_uji", idPrefix: "t", order: 3 };
const build = (overrides?: ImportOverrides, paragraphs: readonly string[] = TEMPLATE) => buildUnit(parseUnitTemplate(paragraphs), { ...OPTIONS, overrides });

describe("buildUnit: bentuk unit", () => {
  const { raw, unit, warnings } = build();

  test("metadata unit: tipe conversation, judul dari template, deskripsi memuat nomor unit dan tingkat", () => {
    expect(raw).toMatchObject({ id: "unit_uji", order: 3, title: "Percakapan di Tempat Kerja", type: "conversation" });
    expect(raw.description).toBe("Unit 3 · N4–N3 — 2 pola kalimat untuk percakapan di tempat kerja.");
    expect(unit.type).toBe("conversation");
  });

  test("judul dan deskripsi bisa diganti lewat opsi", () => {
    const custom = buildUnit(parseUnitTemplate(TEMPLATE), { ...OPTIONS, title: "Judul Lain", description: "Deskripsi lain" });
    expect(custom.raw).toMatchObject({ title: "Judul Lain", description: "Deskripsi lain" });
  });

  test("satu bagian = satu pelajaran (id, judul), dan satu catatan tata bahasa per pelajaran dengan lesson_id", () => {
    expect(raw.lessons.map((l) => [l.id, l.title])).toEqual([
      ["t_l1", "Keadaan Sedang Berlangsung (～ている)"],
      ["t_l2", "Membiasakan diri (～ようにしている)"],
    ]);
    expect(raw.grammar_notes.map((n) => [n.id, n.lesson_id])).toEqual([
      ["t_l1_g", "t_l1"],
      ["t_l2_g", "t_l2"],
    ]);
    expect(unit.grammarNotes[0]).toMatchObject({ id: "t_l1_g", lessonId: "t_l1" });
  });

  test("catatan: pola, seluruh rangkaian bentuk (JP lalu Indonesia), dan kalimat penuh tiap entri sebagai contoh", () => {
    expect(raw.grammar_notes[0]?.body_md).toBe(
      [
        "Pola: ～ている (te iru)",
        "",
        "Rangkaian bentuk:",
        "- 始める → 始めている → 始めているところです",
        "  Mulai → Sedang mulai → Baru saja (sedang) mulai",
        "- 降る → 降っている → 降っているようです/降っているみたいです",
        "  Turun → Sedang turun → Rupanya/Sepertinya sedang turun",
        "",
        "Contoh kalimat:",
        "- ちょうど今、会議が始めているところです。",
        "  Tepat sekarang, rapatnya baru saja mulai.",
        "- 外は雨が降っているようです。 / 外は雨が降っているみたいです。",
        "  Di luar rupanya/sepertinya sedang turun hujan.",
      ].join("\n"),
    );
  });

  test("lolos unitSchema dan tidak ada peringatan untuk template yang rapi (kecuali salinan ganda yang memang dibuang)", () => {
    expect(() => unitSchema.parse(raw)).not.toThrow();
    expect(warnings.map((w) => w.message)).toEqual([expect.stringMatching(/kalimat ganda berurutan dilewati/)]);
  });
});

describe("buildUnit: kosakata", () => {
  const { raw } = build();

  test("kata dasar tiap entri dan rangkaian tambahan jadi kosakata: id dari romaji, bacaan dari romaji, arti dari template", () => {
    expect(raw.vocab).toEqual([
      { id: "tv_hajimeru", surface: "始める", kana: "はじめる", romaji: "hajimeru", meaning_id: "Mulai", image: null, audio: "" },
      { id: "tv_furu", surface: "降る", kana: "ふる", romaji: "furu", meaning_id: "Turun", image: null, audio: "" },
      { id: "tv_taberu", surface: "食べる", kana: "たべる", romaji: "taberu", meaning_id: "Makan", image: null, audio: "" },
      { id: "tv_kenkou", surface: "健康", kana: "けんこう", romaji: "kenkou", meaning_id: "Kesehatan", image: null, audio: "" },
    ]);
  });

  test("kata yang sama di dua bagian hanya satu kosakata, id bentrok diberi akhiran", () => {
    const paragraphs = [
      ...TEMPLATE.slice(0, 2),
      "A (～a ... a )",
      "① ・ Haru – Haru ni naru",
      "貼る – 貼ることになる",
      "Tempel – Jadi ditempel",
      ...triple("Haru koto ni naru", "貼ることになる", "Jadi ditempel"),
      "B (～b ... b )",
      "① ・ Haru – Haru rashii",
      "春 – 春らしい",
      "Musim semi – Layaknya musim semi",
      ...triple("Haru rashii hi", "春らしい日", "Hari yang seperti musim semi"),
      "C (～c ... c )",
      "① ・ Haru – Haru ni naru",
      "貼る – 貼ることになる",
      "Tempel – Jadi ditempel",
      ...triple("Haru koto ni naru", "貼ることになる", "Jadi ditempel"),
    ];
    const result = build(undefined, paragraphs);
    expect(result.raw.vocab.map((v) => [v.id, v.surface])).toEqual([
      ["tv_haru", "貼る"],
      ["tv_haru_2", "春"],
    ]);
  });
});

describe("buildUnit: kalimat, bacaan, dan potongan susun", () => {
  const { raw } = build();
  const sentence = (id: string) => raw.sentences.find((s) => s.id === id);

  test("id kalimat = bagian_entri_langkah; bentuk 'A/B' menjadi dua kalimat berakhiran _a/_b dengan arti yang sama", () => {
    expect(raw.sentences.map((s) => s.id)).toEqual([
      "ts_1_1_1",
      "ts_1_1_2",
      "ts_1_2_1_a",
      "ts_1_2_1_b",
      "ts_1_2_2_a",
      "ts_1_2_2_b",
      "ts_2_1_1",
      "ts_2_1_2",
    ]);
    expect(sentence("ts_1_2_1_a")).toMatchObject({ surface: "雨が降っているようです", meaning_id: "Rupanya/Sepertinya sedang turun hujan" });
    expect(sentence("ts_1_2_1_b")).toMatchObject({ surface: "雨が降っているみたいです", meaning_id: "Rupanya/Sepertinya sedang turun hujan" });
  });

  test("bacaan (kana): kanji dari romaji, kana dan tanda baca asli dipertahankan", () => {
    expect(sentence("ts_1_1_1")?.kana).toBe("かいぎがはじめているところです");
    expect(sentence("ts_1_1_2")?.kana).toBe("ちょうどいま、かいぎがはじめているところです。");
    expect(sentence("ts_2_1_2")?.kana).toBe("けんこうのために、やさいをたべるようにしています。");
  });

  test("potongan susun diturunkan dari rangkaian bentuk dan langkah sebelumnya, dan selalu menyusun kalimatnya persis", () => {
    expect(sentence("ts_1_1_1")?.assemble_tokens).toEqual(["会議が", "始めている", "ところです"]);
    expect(sentence("ts_1_1_2")?.assemble_tokens).toEqual(["ちょうど今、", "会議が", "始めている", "ところです。"]);
    expect(sentence("ts_1_2_2_b")?.assemble_tokens).toEqual(["外は", "雨が", "降っている", "みたいです。"]);
    expect(sentence("ts_2_1_2")?.assemble_tokens).toEqual(["健康", "のために、", "野菜を", "食べる", "ように", "しています。"]);
    for (const s of raw.sentences) expect(s.assemble_tokens.join("")).toBe(s.surface);
  });

  test("words = potongan dengan bacaannya; potongan yang memotong deretan kanji memakai tulisannya sendiri", () => {
    expect(sentence("ts_1_1_1")?.words).toEqual([
      { surface: "会議が", kana: "かいぎが" },
      { surface: "始めている", kana: "はじめている" },
      { surface: "ところです", kana: "ところです" },
    ]);
    const paragraphs = [
      ...TEMPLATE.slice(0, 2),
      "Pola (～ている ... te iru )",
      "① ・ Tsuzuku – Tsuzuite iru",
      "続く – 続いている",
      "Berlanjut – Sedang berlanjut",
      ...triple("Zan’gyou ga tsuzuite iru", "残業が続いている", "Lembur terus"),
      ...triple("Mainichi zan’gyou ga tsuzuite iru", "毎日残業が続いている", "Setiap hari lembur terus"),
    ];
    const result = build(undefined, paragraphs);
    const second = result.raw.sentences[1];
    expect(second?.assemble_tokens).toEqual(["毎日", "残業が", "続いている"]);
    expect(second?.kana).toBe("まいにちざんぎょうがつずいている");
    expect(second?.words[0]).toEqual({ surface: "毎日", kana: "毎日" });
    expect(second?.words[2]).toEqual({ surface: "続いている", kana: "つずいている" });
  });

  test("romaji yang tak cocok dengan tulisan Jepang: bacaan memakai tulisan aslinya dan dilaporkan (bukan bacaan salah)", () => {
    const paragraphs = TEMPLATE.map((line) => line.replace("Kaigi ga hajimete iru tokoro desu", "Kaigi ga hajimete iru tokoro"));
    const result = build(undefined, paragraphs);
    expect(result.raw.sentences[0]?.kana).toBe("会議が始めているところです");
    expect(result.warnings.map((w) => w.message)).toContainEqual(expect.stringMatching(/romaji "Kaigi ga hajimete iru tokoro" tidak cocok dengan "会議が始めているところです"/));
  });
});

describe("buildUnit: latihan per pelajaran", () => {
  const { raw } = build();

  test("tiap entri: pilih arti kata dasar -> susun tiap kalimat bertahap -> pilih arti kalimat penuh", () => {
    expect(raw.lessons[0]?.exercises).toEqual([
      { type: "choose", ref: "tv_hajimeru" },
      { type: "assemble", ref: "ts_1_1_1" },
      { type: "assemble", ref: "ts_1_1_2" },
      { type: "choose", ref: "ts_1_1_2" },
      { type: "choose", ref: "tv_furu" },
      { type: "assemble", ref: "ts_1_2_1_a" },
      { type: "assemble", ref: "ts_1_2_1_b" },
      { type: "assemble", ref: "ts_1_2_2_a" },
      { type: "assemble", ref: "ts_1_2_2_b" },
      { type: "choose", ref: "ts_1_2_2_a" },
    ]);
  });

  test("rangkaian tambahan menyisipkan soal kata bantunya tepat sebelum kalimat yang memakainya", () => {
    expect(raw.lessons[1]?.exercises).toEqual([
      { type: "choose", ref: "tv_taberu" },
      { type: "assemble", ref: "ts_2_1_1" },
      { type: "choose", ref: "tv_kenkou" },
      { type: "assemble", ref: "ts_2_1_2" },
      { type: "choose", ref: "ts_2_1_2" },
    ]);
  });

  test("semua soal bisa disiapkan ExerciseFactory dari unit hasil unitSchema (acuan ada, pilihan dan potongan benar)", () => {
    const { unit } = build();
    for (const lesson of unit.lessons) {
      const factory = new ExerciseFactory({ unit, lesson, rng: () => 0.5 });
      for (const exercise of lesson.exercises) {
        const prepared = factory.prepare(exercise);
        if (prepared.kind === "choose") expect(prepared.options[prepared.correctIndex]).toBeDefined();
        else expect(prepared.correct.join("")).toBe(unit.sentences.find((s) => s.id === exercise.ref)?.surface);
      }
    }
  });
});

describe("buildUnit: perbaikan teks dan pengganti (overrides)", () => {
  test("perbaikan teks diterapkan di bidang yang disebut dan dilaporkan jumlahnya", () => {
    const { raw, appliedFixes } = build({
      textFixes: [
        { field: "id", from: "Rapatnya", to: "Rapat", why: "uji" },
        { field: "romaji", from: "Choudo", to: "Chōdo", why: "uji" },
        { field: "jp", from: "ちょうど", to: "ちょうど", why: "uji" },
      ],
    });
    expect(raw.sentences[0]?.meaning_id).toBe("Rapat baru saja mulai");
    expect(raw.sentences[1]?.romaji).toBe("chōdo ima, kaigi ga hajimete iru tokoro desu.");
    expect(appliedFixes.map((a) => a.count)).toEqual([1, 1, 1]);
  });

  test("perbaikan yang tak menemukan teksnya dilaporkan (cegah perbaikan basi diam-diam)", () => {
    const { warnings } = build({ textFixes: [{ field: "id", from: "tidak ada teks ini", to: "x", why: "uji alasan" }] });
    expect(warnings.map((w) => w.message)).toContainEqual(expect.stringContaining('perbaikan tidak terpakai (teks "tidak ada teks ini" tidak ditemukan di id): uji alasan'));
  });

  test("potongan pengganti dipakai (dan diteruskan ke kalimat yang memuatnya); pengganti yang tak terpakai dilaporkan", () => {
    const { raw, warnings } = build({
      tokens: { 会議が始めているところです: ["会議", "が", "始めている", "ところです"], 悪い: ["悪", "い"] },
    });
    expect(raw.sentences[0]?.assemble_tokens).toEqual(["会議", "が", "始めている", "ところです"]);
    expect(raw.sentences[1]?.assemble_tokens).toEqual(["ちょうど今、", "会議", "が", "始めている", "ところです。"]);
    expect(warnings.map((w) => w.message)).toContainEqual(expect.stringContaining("pengganti potongan tidak terpakai (kalimat tidak ada di template): 悪い"));
  });

  test("potongan pengganti yang gabungannya bukan kalimatnya ditolak dengan pesan yang menunjuk entrinya", () => {
    expect(() => build({ tokens: { 会議が始めているところです: ["会議が", "始めている"] } })).toThrow(/bagian 1 \(Keadaan Sedang Berlangsung\) › entri 1.*tidak membentuk kalimat/);
  });

  test("bacaan kanji pengganti (runReadings) dipakai di kalimat dan kosakata", () => {
    const paragraphs = [
      ...TEMPLATE.slice(0, 2),
      "Pola (～ている ... te iru )",
      "① ・ Tsuzuku – Tsuzuite iru",
      "続く – 続いている",
      "Berlanjut – Sedang berlanjut",
      ...triple("Zan’gyou ga tsuzuite iru", "残業が続いている", "Lembur terus"),
    ];
    const { raw } = build({ runReadings: { 続: "つづ" } }, paragraphs);
    expect(raw.sentences[0]?.kana).toBe("ざんぎょうがつづいている");
    expect(raw.vocab[0]?.kana).toBe("つづく");
  });
});

describe("buildUnit: peringatan yang diterima (acceptedWarnings)", () => {
  test("peringatan yang cocok ditandai accepted (alasan tercatat di overrides); yang lain tetap menunggu", () => {
    const { warnings } = build({ acceptedWarnings: [{ contains: "kalimat ganda berurutan dilewati", why: "salinan ganda di template" }] });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ accepted: true, message: expect.stringContaining("kalimat ganda berurutan dilewati") });
    expect(build().warnings[0]?.accepted).toBeUndefined();
  });

  test("penerimaan yang tak cocok peringatan mana pun dilaporkan (cegah daftar penerimaan basi)", () => {
    const { warnings } = build({ acceptedWarnings: [{ contains: "tidak ada peringatan seperti ini", why: "alasan lama" }] });
    expect(warnings.map((w) => w.message)).toContainEqual(expect.stringContaining('penerimaan peringatan tidak terpakai (tak ada peringatan memuat "tidak ada peringatan seperti ini"): alasan lama'));
  });
});

describe("buildUnit: bagian tanpa bahan yang cukup", () => {
  test("kalimat satu potongan tidak dibuatkan soal susun; kosakata tanpa arti tidak dibuatkan soal pilih; keduanya dilaporkan", () => {
    const paragraphs = [
      ...TEMPLATE.slice(0, 2),
      "Pola (～ください ... kudasai )",
      "① ・ Isogu – Isoide",
      "急ぐ – 急いで",
      "Bergegas",
      ...triple("Mou", "もう", "Sudah"),
    ];
    const { raw, warnings } = build(undefined, paragraphs);
    expect(raw.vocab[0]).toMatchObject({ surface: "急ぐ", meaning_id: "Bergegas" });
    expect(raw.lessons[0]?.exercises).toEqual([{ type: "choose", ref: "tv_isogu" }, { type: "choose", ref: "ts_1_1_1" }]);
    expect(warnings.map((w) => w.message)).toContainEqual(expect.stringMatching(/kalimat "もう" cuma satu potongan/));
  });
});
