import type { GrammarNote } from "@elearning/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { NotesPanel, NotesToggle } from "./LessonNotes";

const NOTES: GrammarNote[] = [
  { id: "g1", title: "Keadaan Sedang Berlangsung (～ている)", bodyMd: "Pola: ～ている (te iru)\n\nContoh kalimat:\n- 雨が降っている\n  Hujan sedang turun", lessonId: "l1" },
  { id: "g2", title: "Catatan kedua", bodyMd: "Isi kedua.", lessonId: "l1" },
];

/** Perakitan seperti di LessonPage: tombol di bilah atas, panel muncul sesudahnya. */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <NotesToggle open={open} onToggle={() => setOpen((v) => !v)} />
      {open && <NotesPanel notes={NOTES} />}
    </div>
  );
}

describe("catatan pelajaran", () => {
  it("awalnya tertutup: tombol 'Catatan' (aria-expanded=false) dan belum ada panel", () => {
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: "Catatan" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("lesson-notes");
    expect(screen.queryByRole("region", { name: "Catatan tata bahasa" })).toBeNull();
  });

  it("diketuk: panel terbuka berisi judul dan isi tiap catatan; diketuk lagi: tertutup", () => {
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: "Catatan" });
    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("region", { name: "Catatan tata bahasa" });
    expect(panel.id).toBe("lesson-notes");
    expect(panel.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("heading", { level: 2, name: /Keadaan Sedang Berlangsung \(～ている\)/ })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: /Catatan kedua/ })).toBeTruthy();
    expect(panel.textContent).toContain("雨が降っている");
    expect(panel.textContent).toContain("Hujan sedang turun");
    expect(panel.textContent).toContain("Isi kedua.");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("region", { name: "Catatan tata bahasa" })).toBeNull();
  });
});
