import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderPage } from "../test/render";
import { KANA_PATH } from "../lib/kana";
import { KanaPage } from "./KanaPage";

afterEach(cleanup);

function renderKana(search = "") {
  return renderPage(<KanaPage />, { path: KANA_PATH, entry: `${KANA_PATH}${search}`, destinations: ["/"] });
}

const tab = (id: string) => screen.getByTestId(`kana-tab-${id}`);

describe("KanaPage", () => {
  it("bawaan: pengantar tiga jenis huruf dengan contoh kalimat berfurigana", () => {
    renderKana();

    expect(tab("pengantar").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Tiga jenis huruf" })).toBeTruthy();
    for (const script of ["hiragana", "katakana", "kanji"]) expect(screen.getByTestId(`script-${script}`)).toBeTruthy();
    const example = screen.getByTestId("example-sentence");
    expect(Array.from(example.querySelectorAll("rt")).map((rt) => rt.textContent)).toEqual(["わたし", "じん"]);
    expect(example.textContent).toContain("Saya orang Indonesia.");
  });

  it("tab Hiragana: tabel per baris konsonan berisi 104 huruf, kolom dan baris berjudul", () => {
    renderKana();
    fireEvent.click(tab("hiragana"));

    expect(tab("hiragana").getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByTestId("kana-cell")).toHaveLength(104);
    const dasar = screen.getByTestId("kana-section-dasar");
    expect(within(dasar).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["a", "i", "u", "e", "o"]);
    expect(within(dasar).getByRole("rowheader", { name: "k" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Tiga jenis huruf" })).toBeNull();
  });

  it("huruf yang tidak mengikuti pola ditandai, juga untuk pembaca layar", () => {
    renderKana("?tab=hiragana");

    const shi = screen.getAllByTestId("kana-cell").find((cell) => cell.textContent?.startsWith("しshi"))!;
    expect(shi.textContent).toContain("tidak mengikuti pola baris");
    const ka = screen.getAllByTestId("kana-cell").find((cell) => cell.textContent?.startsWith("かka"))!;
    expect(ka.textContent).not.toContain("tidak mengikuti pola");
    expect(screen.getByTestId("kana-legend").textContent).toContain("ditulis wo tetapi dibaca o");
  });

  it("?tab=katakana membuka tabel katakana langsung", () => {
    renderKana("?tab=katakana");

    expect(tab("katakana").getAttribute("aria-selected")).toBe("true");
    const cells = screen.getAllByTestId("kana-cell").map((cell) => cell.textContent);
    expect(cells[0]).toBe("アa");
    expect(cells).toContain("キャkya");
    expect(screen.getByText(/Unit Katakana belum tersedia/)).toBeTruthy();
  });

  it("nilai tab yang tidak dikenal kembali ke pengantar", () => {
    renderKana("?tab=ngawur");

    expect(tab("pengantar").getAttribute("aria-selected")).toBe("true");
  });

  it("tombol di akhir pengantar membuka tabel hiragana", () => {
    renderKana();
    fireEvent.click(screen.getByRole("button", { name: /Lihat tabel hiragana/ }));

    expect(tab("hiragana").getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByTestId("kana-cell")).toHaveLength(104);
  });
});
