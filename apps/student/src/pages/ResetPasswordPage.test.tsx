import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStorage } from "../auth/api-client";
import { INVALID_INPUT_TEXT, NETWORK_ERROR_TEXT } from "../auth/api-errors";
import { callsTo, mockApi, type MockHandler } from "../test/api-mock";
import { renderPage } from "../test/render";
import { PASSWORD_RESET_DONE_NOTICE, ResetPasswordPage } from "./ResetPasswordPage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

const RESET = "/auth/reset";
const TOKEN = "reset-tok";

function renderReset(handler: MockHandler = () => ({ data: { message: "ok" } })) {
  mockApi({ POST: { [RESET]: handler } });
  return renderPage(<ResetPasswordPage />, {
    path: "/reset-password/:token",
    entry: `/reset-password/${TOKEN}`,
    destinations: ["/login", "/forgot-password"],
  });
}

function submit(password: string, confirmation = password) {
  fireEvent.change(screen.getByLabelText("Password baru"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Konfirmasi password baru"), { target: { value: confirmation } });
  fireEvent.click(screen.getByRole("button", { name: "Simpan Password" }));
}

function alertText() {
  return screen.getByRole("alert").textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResetPasswordPage", () => {
  it("menampilkan form dengan petunjuk aturan password dan tautan kembali", () => {
    renderReset();

    expect(screen.getByRole("heading", { level: 1, name: "Atur Ulang Password" })).toBeTruthy();
    expect(screen.getByText("Minimal 8 karakter, mengandung huruf dan angka.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Kembali ke halaman masuk" }).getAttribute("href")).toBe("/login");
  });

  it.each([
    ["terlalu pendek", "abc12", "abc12", "Password minimal 8 karakter."],
    ["tanpa angka", "abcdefgh", "abcdefgh", "Password harus mengandung huruf dan angka."],
    ["tanpa huruf", "12345678", "12345678", "Password harus mengandung huruf dan angka."],
    ["konfirmasi tidak sama", "Rahasia123", "Rahasia124", "Konfirmasi password tidak sama."],
  ])("validasi klien: password %s -> pesan jelas dan TIDAK ada request reset", (_label, password, confirmation, message) => {
    renderReset();

    submit(password, confirmation);

    expect(alertText()).toBe(message);
    expect(callsTo("POST", RESET)).toHaveLength(0);
  });

  it("sukses: kirim {token dari URL, password}, bersihkan token perangkat, ke /login dengan pesan sukses", async () => {
    renderReset();

    submit("Rahasia123");

    await waitFor(() => expect(screen.getByTestId("destination-path").textContent).toBe("/login"));
    expect(callsTo("POST", RESET)).toEqual([[RESET, { body: { token: TOKEN, password: "Rahasia123" } }]]);
    // Reset mencabut semua sesi di server -- sesi tersimpan di perangkat ini sudah mati.
    expect(tokenStorage.clear).toHaveBeenCalledTimes(1);
    expect(JSON.parse(screen.getByTestId("destination-state").textContent ?? "null")).toEqual({ notice: PASSWORD_RESET_DONE_NOTICE });
  });

  it("selama menunggu server: tombol 'Menyimpan...' nonaktif", async () => {
    let finish: (value: { data: unknown }) => void = () => {};
    renderReset(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    submit("Rahasia123");

    const busy = (await screen.findByRole("button", { name: "Menyimpan..." })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    finish({ data: { message: "ok" } });
    await waitFor(() => expect(screen.getByTestId("destination-path").textContent).toBe("/login"));
  });

  it("400 pesan bisnis (token kedaluwarsa/terpakai): halaman 'Tautan Reset Tidak Berlaku' + minta tautan baru; sesi lokal TIDAK dibersihkan", async () => {
    renderReset(() => ({ error: { statusCode: 400, message: "Token reset tidak valid atau sudah kedaluwarsa" }, status: 400 }));

    submit("Rahasia123");

    expect(await screen.findByRole("heading", { level: 1, name: "Tautan Reset Tidak Berlaku" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Minta Tautan Reset Baru" }).getAttribute("href")).toBe("/forgot-password");
    expect(screen.queryByLabelText("Password baru")).toBeNull();
    expect(tokenStorage.clear).not.toHaveBeenCalled();
  });

  it("400 validasi (message array, Inggris): teks Indonesia tetap dan form BERTAHAN (bukan 'tautan tidak berlaku')", async () => {
    renderReset(() => ({ error: { statusCode: 400, message: ["password must be longer than or equal to 8 characters"] }, status: 400 }));

    submit("Rahasia123");

    await waitFor(() => expect(alertText()).toBe(INVALID_INPUT_TEXT));
    expect(document.body.textContent).not.toContain("must be longer");
    expect(screen.queryByRole("heading", { name: "Tautan Reset Tidak Berlaku" })).toBeNull();
  });

  it("429: pesan terlalu banyak percobaan, form tetap bisa dicoba lagi", async () => {
    renderReset(() => ({ error: { statusCode: 429, message: "ThrottlerException: Too Many Requests" }, status: 429 }));

    submit("Rahasia123");

    await waitFor(() => expect(alertText()).toBe("Terlalu banyak percobaan. Coba lagi beberapa saat lagi."));
    expect((screen.getByRole("button", { name: "Simpan Password" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("gangguan jaringan: pesan jaringan, tombol aktif lagi, sesi lokal utuh", async () => {
    renderReset(() => {
      throw new TypeError("Failed to fetch");
    });

    submit("Rahasia123");

    await waitFor(() => expect(alertText()).toBe(NETWORK_ERROR_TEXT));
    expect((screen.getByRole("button", { name: "Simpan Password" }) as HTMLButtonElement).disabled).toBe(false);
    expect(tokenStorage.clear).not.toHaveBeenCalled();
  });
});
