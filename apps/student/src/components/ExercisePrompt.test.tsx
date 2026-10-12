import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExercisePrompt } from "./ExercisePrompt";

afterEach(cleanup);

const prompt = () => screen.getByTestId("exercise-prompt");

// jsdom tidak menghitung tata letak, jadi yang dicek di sini aturan gayanya. Bahwa きゃ benar-benar tampil satu baris
// sudah diukur di Chromium sungguhan (lihat docs/PLAN.md, bagian 7o).
describe("ExercisePrompt", () => {
  it("satu huruf kana: ubin besar", () => {
    render(<ExercisePrompt text="あ" />);
    expect(prompt().textContent).toBe("あ");
    expect(prompt().className).toContain("rounded-[2rem]");
    expect(prompt().className).toContain("text-7xl");
    expect(prompt().getAttribute("lang")).toBe("ja");
  });

  it("dua karakter satu suku kata (きゃ): ubin melebar mengikuti isi dan tidak boleh patah baris", () => {
    render(<ExercisePrompt text="きゃ" />);
    const classes = prompt().className.split(/\s+/);
    expect(classes).toContain("whitespace-nowrap");
    expect(classes).toContain("w-fit");
    expect(classes).not.toContain("w-32"); // lebar tetap 128 px inilah yang dulu mematahkan き / ゃ
    expect(classes).toContain("text-6xl");
  });

  it("kata kanji dua huruf (学生) juga satu baris", () => {
    render(<ExercisePrompt text="学生" sub="がくせい" />);
    expect(prompt().className).toContain("whitespace-nowrap");
    expect(screen.getByText("がくせい")).toBeTruthy();
  });

  it("teks yang lebih panjang tampil sebagai teks biasa, bukan ubin", () => {
    render(<ExercisePrompt text="おはよう" />);
    expect(prompt().className).not.toContain("rounded-[2rem]");
    expect(prompt().className).toContain("[word-break:auto-phrase]");
  });

  it("varian kecil (soal susun kalimat) tidak pernah jadi ubin", () => {
    render(<ExercisePrompt text="あ" small />);
    expect(prompt().className).not.toContain("rounded-[2rem]");
    expect(prompt().className).toContain("text-xl");
  });
});
