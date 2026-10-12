import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";
import type { ComposerProps } from "./Composer";

function renderComposer(overrides: Partial<ComposerProps> = {}) {
  const props: ComposerProps = {
    draft: "",
    onDraftChange: vi.fn(),
    draftFromVoice: false,
    onSend: vi.fn(),
    onHelp: vi.fn(),
    onMicToggle: vi.fn(),
    recorderStatus: "idle",
    elapsedMs: 0,
    maxRecordingSeconds: 30,
    micAvailable: true,
    phase: "idle",
    characterName: "Yuki",
    disabled: false,
    inputRef: createRef<HTMLInputElement>(),
    ...overrides,
  };
  render(<Composer {...props} />);
  return props;
}

const input = () => screen.getByTestId("chat-input") as HTMLInputElement;
const send = () => screen.getByTestId("send-button") as HTMLButtonElement;
const mic = () => screen.getByTestId("mic-button") as HTMLButtonElement;
const help = () => screen.getByTestId("help-button") as HTMLButtonElement;

describe("Composer", () => {
  it("keadaan awal: kolom ketik kosong, kirim mati, mikrofon dan bantuan aktif", () => {
    renderComposer();

    expect(input().value).toBe("");
    expect(input().getAttribute("lang")).toBe("ja");
    expect(input().maxLength).toBe(500);
    expect(send().disabled).toBe(true);
    expect(mic().disabled).toBe(false);
    expect(mic().getAttribute("aria-label")).toBe("Mulai merekam suara");
    expect(help().disabled).toBe(false);
  });

  it("mengetik meneruskan nilai ke onDraftChange", () => {
    const props = renderComposer();

    fireEvent.change(input(), { target: { value: "こんにちは" } });

    expect(props.onDraftChange).toHaveBeenCalledWith("こんにちは");
  });

  it("ada isi -> tombol kirim aktif dan formulir terkirim memanggil onSend", () => {
    const props = renderComposer({ draft: "こんにちは。" });

    expect(send().disabled).toBe(false);
    fireEvent.submit(send().closest("form")!);

    expect(props.onSend).toHaveBeenCalledOnce();
  });

  it("hanya spasi dianggap kosong: tidak bisa dikirim, walau formulir dipaksa terkirim", () => {
    const props = renderComposer({ draft: "   " });

    expect(send().disabled).toBe(true);
    fireEvent.submit(send().closest("form")!);

    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("Enter yang dipakai memastikan huruf Jepang (IME sedang menyusun) dibatalkan, Enter biasa tidak", () => {
    renderComposer({ draft: "にほん" });

    fireEvent.compositionStart(input());
    expect(fireEvent.keyDown(input(), { key: "Enter" })).toBe(false); // preventDefault dipanggil
    fireEvent.compositionEnd(input());
    expect(fireEvent.keyDown(input(), { key: "Enter" })).toBe(true); // Enter biasa dibiarkan (mengirim lewat formulir)
  });

  it("tombol lain selama menyusun huruf tidak dihalangi", () => {
    renderComposer({ draft: "に" });

    fireEvent.compositionStart(input());

    expect(fireEvent.keyDown(input(), { key: "a" })).toBe(true);
  });

  it("tombol mikrofon memanggil onMicToggle", () => {
    const props = renderComposer();

    fireEvent.click(mic());

    expect(props.onMicToggle).toHaveBeenCalledOnce();
  });

  it("menunggu izin mikrofon: tombol mati dan ada keterangan", () => {
    renderComposer({ recorderStatus: "starting" });

    expect(mic().disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Menunggu izin mikrofon...");
    expect(input().disabled).toBe(true);
  });

  it("merekam: tombol jadi 'berhenti' (aria-pressed), waktu berjalan tampil, kolom ketik/kirim/bantuan mati", () => {
    renderComposer({ recorderStatus: "recording", elapsedMs: 7_400, draft: "sisa" });

    expect(mic().getAttribute("aria-label")).toBe("Berhenti merekam");
    expect(mic().getAttribute("aria-pressed")).toBe("true");
    expect(mic().disabled).toBe(false); // harus bisa ditekan untuk berhenti
    expect(screen.getByRole("status").textContent).toBe("Merekam 0:07 dari 0:30. Tekan tombol merah untuk berhenti.");
    expect(input().disabled).toBe(true);
    expect(send().disabled).toBe(true);
    expect(help().disabled).toBe(true);
  });

  it("mengenali suara: keterangan dan semua isian mati", () => {
    renderComposer({ phase: "transcribing" });

    expect(screen.getByRole("status").textContent).toBe("Mengenali suaramu...");
    expect(input().disabled).toBe(true);
    expect(mic().disabled).toBe(true);
    expect(help().disabled).toBe(true);
  });

  it("menunggu balasan: keterangan menyebut nama karakter, kirim mati", () => {
    renderComposer({ phase: "replying", characterName: "Sora", draft: "x" });

    expect(screen.getByRole("status").textContent).toBe("Sora sedang menjawab...");
    expect(send().disabled).toBe(true);
    expect(mic().disabled).toBe(true);
  });

  it("isi dari rekaman: ajakan memeriksa teks sebelum dikirim", () => {
    renderComposer({ draft: "わたしはアニです。", draftFromVoice: true });

    expect(screen.getByRole("status").textContent).toBe("Begini yang terdengar. Perbaiki kalau ada yang salah, lalu kirim.");
  });

  it("ajakan itu tidak tampil bila kolom sudah dikosongkan", () => {
    renderComposer({ draft: "", draftFromVoice: true });

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("mikrofon tidak tersedia: tombol mati dengan penjelasan, mengetik tetap bisa", () => {
    renderComposer({ micAvailable: false, draft: "a" });

    expect(mic().disabled).toBe(true);
    expect(mic().getAttribute("title")).toContain("Kamu bisa mengetik");
    expect(input().disabled).toBe(false);
    expect(send().disabled).toBe(false);
  });

  it("seluruh isian dimatikan (jatah habis / AI belum aktif)", () => {
    renderComposer({ disabled: true, draft: "a" });

    expect(input().disabled).toBe(true);
    expect(mic().disabled).toBe(true);
    expect(send().disabled).toBe(true);
    expect(help().disabled).toBe(true);
  });

  it("minta contoh jawaban memanggil onHelp dan menyebut biayanya (1 jatah)", () => {
    const props = renderComposer();

    fireEvent.click(help());

    expect(props.onHelp).toHaveBeenCalledOnce();
    expect(screen.getByText("Memakai 1 jatah balasan.")).toBeTruthy();
  });

  it("ref kolom ketik tersambung (agar halaman bisa memfokuskannya)", () => {
    const inputRef = createRef<HTMLInputElement>();
    renderComposer({ inputRef });

    expect(inputRef.current).toBe(input());
  });
});
