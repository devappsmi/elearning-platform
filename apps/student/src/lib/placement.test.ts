import { describe, expect, it } from "vitest";
import { joinTitles, minimumCorrect } from "./placement";

describe("minimumCorrect", () => {
  it("jawaban benar minimal = persen ambang dibulatkan ke ATAS (sama dengan penilaian server >= 80%)", () => {
    expect(minimumCorrect(15, 80)).toBe(12);
    expect(minimumCorrect(8, 80)).toBe(7); // 6,4 -> 7: 6/8 = 75% belum lulus
    expect(minimumCorrect(7, 80)).toBe(6); // 5,6 -> 6
  });
});

describe("joinTitles", () => {
  it("menggabungkan judul dengan 'dan'", () => {
    expect(joinTitles([])).toBe("");
    expect(joinTitles(["Hiragana"])).toBe("Hiragana");
    expect(joinTitles(["Hiragana", "Katakana"])).toBe("Hiragana dan Katakana");
    expect(joinTitles(["A", "B", "C"])).toBe("A, B, dan C");
  });
});
