import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../../lib/tutor-chat";
import { ChatBubble } from "./ChatBubble";

const AI_REPLY: ChatMessage = { id: 2, role: "assistant", kind: "turn", text: "おなまえは？" };

describe("ChatBubble", () => {
  it("giliran murid: tulisan Jepang ditandai lang=ja; tanpa penanda 'dari suara' bila diketik", () => {
    render(<ChatBubble message={{ id: 1, role: "user", kind: "turn", text: "はじめまして。", via: "typed" }} characterName="Yuki" />);

    expect(screen.getByText("はじめまして。").getAttribute("lang")).toBe("ja");
    expect(screen.queryByText("dari suara")).toBeNull();
  });

  it("giliran murid dari rekaman: ada penanda 'dari suara'", () => {
    render(<ChatBubble message={{ id: 1, role: "user", kind: "turn", text: "こんにちは。", via: "voice" }} characterName="Yuki" />);

    expect(screen.getByText("dari suara")).toBeTruthy();
  });

  it("balasan AI: nama karakter, teks Jepang (lang=ja), dan huruf awal di avatar", () => {
    render(<ChatBubble message={AI_REPLY} characterName="Kenji" />);

    expect(screen.getByText("Kenji", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("おなまえは？").getAttribute("lang")).toBe("ja");
    expect(screen.getByTestId("ai-message").textContent).toContain("K");
  });

  it("tanpa suara diminta: tidak ada tombol maupun keterangan suara", () => {
    render(<ChatBubble message={AI_REPLY} characterName="Yuki" audioState="none" />);

    expect(screen.queryByTestId("play-reply")).toBeNull();
    expect(screen.queryByText(/suara/i)).toBeNull();
  });

  it("suara sedang dibuat: keterangan 'Menyiapkan suara...' tanpa tombol", () => {
    render(<ChatBubble message={AI_REPLY} characterName="Yuki" audioState="loading" />);

    expect(screen.getByText("Menyiapkan suara...")).toBeTruthy();
    expect(screen.queryByTestId("play-reply")).toBeNull();
  });

  it("suara siap: tombol 'Dengarkan' memanggil onPlay", () => {
    const onPlay = vi.fn();
    render(<ChatBubble message={AI_REPLY} characterName="Yuki" audioState="ready" onPlay={onPlay} />);

    fireEvent.click(screen.getByRole("button", { name: "Dengarkan balasan" }));

    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("sedang diputar: tombol berubah label (untuk pembaca layar dan tampilan)", () => {
    render(<ChatBubble message={AI_REPLY} characterName="Yuki" audioState="ready" playing />);

    const button = screen.getByTestId("play-reply");
    expect(button.getAttribute("aria-label")).toBe("Suara sedang diputar");
    expect(button.textContent).toContain("Memutar...");
  });

  it("suara gagal: keterangan jujur, tanpa tombol", () => {
    render(<ChatBubble message={AI_REPLY} characterName="Yuki" audioState="failed" />);

    expect(screen.getByText("Suara belum tersedia untuk balasan ini.")).toBeTruthy();
    expect(screen.queryByTestId("play-reply")).toBeNull();
  });

  it("kartu contoh jawaban: judul memuat nama karakter dan baris baru dipertahankan", () => {
    const text = "Contoh jawaban:\n1. はじめまして。(Senang berkenalan.)\n2. わたしはアニです。";
    render(<ChatBubble message={{ id: 3, role: "assistant", kind: "tip", text }} characterName="Yuki" />);

    expect(screen.getByRole("region", { name: "Contoh jawaban" })).toBeTruthy();
    expect(screen.getByText("Contoh jawaban dari Yuki")).toBeTruthy();
    const body = screen.getByText((_, element) => element?.tagName === "P" && element.textContent === text);
    expect(body.className).toContain("whitespace-pre-line");
  });

  it("kartu contoh jawaban tidak menampilkan tombol suara walau diberi keadaan siap", () => {
    render(<ChatBubble message={{ id: 3, role: "assistant", kind: "tip", text: "Contoh" }} characterName="Yuki" audioState="ready" />);

    expect(screen.queryByTestId("play-reply")).toBeNull();
  });
});
