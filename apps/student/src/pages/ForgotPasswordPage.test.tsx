import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NETWORK_ERROR_TEXT } from "../auth/api-errors";
import { callsTo, mockApi, type MockHandler } from "../test/api-mock";
import { renderPage } from "../test/render";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

const FORGOT = "/auth/forgot";

function renderForgot(handler: MockHandler = () => ({ data: { message: "ok" } })) {
  mockApi({ POST: { [FORGOT]: handler } });
  return renderPage(<ForgotPasswordPage />, { path: "/forgot-password", entry: "/forgot-password", destinations: ["/login"] });
}

function submitEmail(value: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Kirim Tautan Reset" }));
}

function alertText() {
  return screen.getByRole("alert").textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ForgotPasswordPage", () => {
  it("menampilkan form dengan tautan kembali ke halaman masuk", () => {
    renderForgot();

    expect(screen.getByRole("heading", { level: 1, name: "Lupa Password" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Kembali ke halaman masuk" }).getAttribute("href")).toBe("/login");
  });

  it.each([[""], ["   "]])("email kosong (%j) -> pesan jelas dan TIDAK ada request", (value) => {
    renderForgot();

    submitEmail(value);

    expect(alertText()).toBe("Email wajib diisi.");
    expect(callsTo("POST", FORGOT)).toHaveLength(0);
  });

  // Catatan: <input type="email"> membuang spasi tepi nilainya sendiri (algoritma sanitasi HTML,
  // diterapkan juga oleh jsdom), jadi `.trim()` di halaman hanyalah lapisan cadangan dan tidak
  // bisa diuji terpisah lewat DOM -- yang dijamin di sini: email yang DIKIRIM tidak berspasi.
  it("sukses: kirim email tanpa spasi tepi, tampilkan layar 'Cek Emailmu' yang bersyarat (tidak membocorkan ada/tidaknya akun)", async () => {
    renderForgot();

    submitEmail("  budi@example.com  ");

    expect(await screen.findByRole("heading", { level: 1, name: "Cek Emailmu" })).toBeTruthy();
    expect(callsTo("POST", FORGOT)).toEqual([[FORGOT, { body: { email: "budi@example.com" } }]]);
    const status = screen.getByRole("status").textContent ?? "";
    expect(status).toContain("Kalau budi@example.com terdaftar");
    expect(status).toContain("berlaku 1 jam");
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.getByRole("link", { name: "Kembali ke halaman masuk" }).getAttribute("href")).toBe("/login");
  });

  it("'Kirim ke email lain' kembali ke form dengan isian sebelumnya", async () => {
    renderForgot();
    submitEmail("budi@example.com");
    await screen.findByRole("heading", { level: 1, name: "Cek Emailmu" });

    fireEvent.click(screen.getByRole("button", { name: "Kirim ke email lain" }));

    expect(screen.getByRole("heading", { level: 1, name: "Lupa Password" })).toBeTruthy();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("budi@example.com");
  });

  it("selama menunggu server: tombol 'Mengirim...' nonaktif", async () => {
    let finish: (value: { data: unknown }) => void = () => {};
    renderForgot(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    submitEmail("budi@example.com");

    const busy = (await screen.findByRole("button", { name: "Mengirim..." })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    finish({ data: { message: "ok" } });
    expect(await screen.findByRole("heading", { level: 1, name: "Cek Emailmu" })).toBeTruthy();
  });

  it("400 (bentuk email salah): pesan Indonesia, bukan pesan validasi mentah", async () => {
    renderForgot(() => ({ error: { statusCode: 400, message: ["email must be an email"] }, status: 400 }));

    submitEmail("bukan-email");

    await waitFor(() => expect(alertText()).toBe("Format email tidak valid."));
    expect(document.body.textContent).not.toContain("must be an email");
  });

  it.each([
    ["429", { error: { statusCode: 429, message: "ThrottlerException: Too Many Requests" }, status: 429 }, "Terlalu banyak percobaan. Coba lagi beberapa saat lagi."],
    ["500", { error: { statusCode: 500, message: "Internal server error" }, status: 500 }, "Terjadi gangguan di server. Coba lagi sebentar lagi."],
  ])("%s: teks tetap yang ramah, form bisa dicoba lagi", async (_label, result, text) => {
    renderForgot(() => result);

    submitEmail("budi@example.com");

    await waitFor(() => expect(alertText()).toBe(text));
    expect((screen.getByRole("button", { name: "Kirim Tautan Reset" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("gangguan jaringan: pesan jaringan dan tombol aktif lagi", async () => {
    renderForgot(() => {
      throw new TypeError("Failed to fetch");
    });

    submitEmail("budi@example.com");

    await waitFor(() => expect(alertText()).toBe(NETWORK_ERROR_TEXT));
    expect((screen.getByRole("button", { name: "Kirim Tautan Reset" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
