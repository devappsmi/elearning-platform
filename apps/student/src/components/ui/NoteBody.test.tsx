import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoteBody } from "./NoteBody";

const NOTE = [
  "Pola: ～ている (te iru)",
  "",
  "Rangkaian bentuk:",
  "- 始める → 始めている → 始めているところです",
  "  Mulai → Sedang mulai → Baru saja (sedang) mulai",
  "- 続く → 続いている",
  "  Berlanjut → Sedang terus berlanjut",
  "",
  "Contoh kalimat:",
  "- ちょうど今、会議が始めているところです。",
  "  Tepat sekarang, rapatnya baru saja mulai.",
].join("\n");

describe("NoteBody", () => {
  it("paragraf, judul daftar, dan butir daftar dengan baris keduanya", () => {
    const { container } = render(<NoteBody text={NOTE} />);
    const paragraphs = [...container.querySelectorAll("p")].map((p) => p.textContent);
    expect(paragraphs).toEqual([
      "Pola: ～ている (te iru)",
      "Rangkaian bentuk",
      "始める → 始めている → 始めているところです",
      "Mulai → Sedang mulai → Baru saja (sedang) mulai",
      "続く → 続いている",
      "Berlanjut → Sedang terus berlanjut",
      "Contoh kalimat",
      "ちょうど今、会議が始めているところです。",
      "Tepat sekarang, rapatnya baru saja mulai.",
    ]);
    const lists = [...container.querySelectorAll("ul")];
    expect(lists.map((ul) => ul.querySelectorAll("li").length)).toEqual([2, 1]);
  });

  it("paragraf biasa (catatan pendek seperti catatan Hiragana) tampil apa adanya", () => {
    const { container } = render(<NoteBody text="Dua titik kecil (゛) mengubah bunyi: か→が." />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("ul")).toBeNull();
    expect(container.textContent).toBe("Dua titik kecil (゛) mengubah bunyi: か→が.");
  });

  it("baris dalam satu paragraf disambung jeda baris, **tebal** jadi <strong>", () => {
    const { container } = render(<NoteBody text={"Baris **satu**\nBaris dua"} />);
    expect(container.querySelectorAll("br")).toHaveLength(1);
    expect(container.querySelector("strong")?.textContent).toBe("satu");
    expect(container.textContent).toBe("Baris satuBaris dua");
  });

  it("baris sebelum butir pertama yang bukan judul tetap tampil sebagai paragraf", () => {
    const { container } = render(<NoteBody text={"Pengantar singkat\n- butir satu\n- butir dua"} />);
    expect([...container.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["Pengantar singkat", "butir satu", "butir dua"]);
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("teks sumber tidak pernah dianggap HTML", () => {
    const { container } = render(<NoteBody text={'- <img src=x onerror="alert(1)">\n  <b>tebal?</b>'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror="alert(1)"><b>tebal?</b>');
  });

  it("teks kosong tidak merender butir apa pun", () => {
    const { container } = render(<NoteBody text="" />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });
});
