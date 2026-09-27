import { describe, expect, it } from "vitest";
import { ExerciseFactory } from "@elearning/domain";
import { toDomainUnit, type UnitWithContent } from "./content.mapper";

function fakeUnit(overrides: Partial<UnitWithContent> = {}): UnitWithContent {
  return {
    id: "unit_hiragana",
    levelId: "level_hiragana",
    title: "Hiragana",
    order: 1,
    description: "Belajar huruf hiragana",
    type: "KANA",
    grammarNotes: [{ id: "g1", title: "Dakuten", body_md: "..." }],
    vocab: [
      { id: "k_a", unitId: "unit_hiragana", jp: "あ", reading: "あ", romaji: "a", meaningId: null, partOfSpeech: null, exampleJp: null, exampleId: null },
      { id: "k_i", unitId: "unit_hiragana", jp: "い", reading: "い", romaji: "i", meaningId: null, partOfSpeech: null, exampleJp: null, exampleId: null },
    ],
    sentences: [
      {
        id: "w_ai",
        unitId: "unit_hiragana",
        surface: "愛",
        kana: "あい",
        romaji: "ai",
        meaning: "cinta",
        words: [{ surface: "愛", kana: "あい" }],
        assembleTokens: ["あ", "い"],
        voice: "female",
      },
    ],
    lessons: [
      {
        id: "l1",
        unitId: "unit_hiragana",
        title: "Baris a",
        order: 0,
        isCheckpoint: false,
        exercises: [
          { id: "l1_0", lessonId: "l1", type: "CHOOSE", order: 0, payload: { ref: "k_a", variant: "kana_to_romaji" }, difficulty: 1 },
          { id: "l1_1", lessonId: "l1", type: "ASSEMBLE", order: 1, payload: { ref: "w_ai" }, difficulty: 1 },
        ],
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(overrides as any),
  } as unknown as UnitWithContent;
}

describe("toDomainUnit", () => {
  it("maps vocab/sentence/lesson fields to domain shape", () => {
    const unit = toDomainUnit(fakeUnit());
    expect(unit.type).toBe("kana");
    expect(unit.vocab).toEqual([
      { id: "k_a", surface: "あ", kana: "あ", romaji: "a", audio: "", meaning: undefined, image: undefined },
      { id: "k_i", surface: "い", kana: "い", romaji: "i", audio: "", meaning: undefined, image: undefined },
    ]);
    expect(unit.sentences[0]).toMatchObject({ id: "w_ai", surface: "愛", meaning: "cinta", assembleTokens: ["あ", "い"] });
    expect(unit.lessons[0]?.exercises).toEqual([
      { type: "choose", ref: "k_a", variant: "kana_to_romaji" },
      { type: "assemble", ref: "w_ai", variant: undefined },
    ]);
  });

  it("maps meaningId -> meaning (undefined when null)", () => {
    const unit = toDomainUnit(fakeUnit());
    expect(unit.vocab.every((v) => v.meaning === undefined)).toBe(true);
  });

  it("produces output ExerciseFactory can actually run (not just structurally similar)", () => {
    const unit = toDomainUnit(fakeUnit());
    const lesson = unit.lessons[0]!;
    const factory = new ExerciseFactory({ unit, lesson, rng: () => 0 });
    const chosen = factory.prepare(lesson.exercises[0]!);
    expect(chosen.kind).toBe("choose");
    const assembled = factory.prepare(lesson.exercises[1]!);
    expect(assembled.kind).toBe("assemble");
  });

  it("throws a clear error for an unsupported exercise type", () => {
    const unit = fakeUnit({
      lessons: [
        {
          id: "l1",
          unitId: "unit_hiragana",
          title: "Baris a",
          order: 0,
          isCheckpoint: false,
          exercises: [{ id: "l1_0", lessonId: "l1", type: "FILL_IN", order: 0, payload: { ref: "k_a" }, difficulty: 1 }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
    });
    expect(() => toDomainUnit(unit)).toThrow(/belum didukung/);
  });

  it("throws a clear error for a malformed payload", () => {
    const unit = fakeUnit({
      lessons: [
        {
          id: "l1",
          unitId: "unit_hiragana",
          title: "Baris a",
          order: 0,
          isCheckpoint: false,
          exercises: [{ id: "l1_0", lessonId: "l1", type: "CHOOSE", order: 0, payload: { oops: true }, difficulty: 1 }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
    });
    expect(() => toDomainUnit(unit)).toThrow(/payload tidak valid/);
  });
});
