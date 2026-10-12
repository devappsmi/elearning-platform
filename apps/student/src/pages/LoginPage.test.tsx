import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStorage } from "../auth/api-client";
import { NETWORK_ERROR_TEXT } from "../auth/api-errors";
import { callsTo, mockApi, type MockHandler } from "../test/api-mock";
import { renderPage } from "../test/render";
import { INVALID_CREDENTIALS_TEXT, LoginPage } from "./LoginPage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

const LOGIN = "/auth/login";
const TOKENS = { accessToken: "access-1", refreshToken: "refresh-1" };
const LOCKOUT_MESSAGE = "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.";

function renderLogin(handler: MockHandler = () => ({ data: TOKENS }), entry: Parameters<typeof renderPage>[1]["entry"] = "/login") {
  mockApi({ POST: { [LOGIN]: handler } });
  return renderPage(<LoginPage />, { path: "/login", entry, destinations: ["/", "/learn/l-1"] });
}

function submit(email = "budi@example.com", password = "Rahasia123") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
}

function alertText() {
  return screen.getByRole("alert").textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tokenStorage.getAccessToken).mockReturnValue(null);
  vi.mocked(tokenStorage.getRefreshToken).mockReturnValue(null);
});

describe("LoginPage", () => {
  it("menampilkan form masuk dengan tautan 'Lupa password?' ke /forgot-password", () => {
    renderLogin();

    expect(screen.getByRole("heading", { level: 1, name: "Masuk" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Lupa password?" }).getAttribute("href")).toBe("/forgot-password");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("menampilkan pesan sekali-tampil dari halaman lain (mis. setelah reset password)", () => {
    renderLogin(undefined, { pathname: "/login", state: { notice: "Password berhasil diubah. Silakan masuk dengan password barumu." } });

    expect(screen.getByRole("status").textContent).toBe("Password berhasil diubah. Silakan masuk dengan password barumu.");
  });

  it("sudah punya token tersimpan -> langsung dialihkan ke beranda tanpa menampilkan form", () => {
    vi.mocked(tokenStorage.getRefreshToken).mockReturnValue("refresh-lama");

    renderLogin();

    expect(screen.getByTestId("destination-path").textContent).toBe("/");
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("sukses: kirim {email, password}, simpan token, ke beranda", async () => {
    renderLogin();

    submit();

    await waitFor(() => expect(screen.getByTestId("destination-path").textContent).toBe("/"));
    expect(callsTo("POST", LOGIN)).toEqual([[LOGIN, { body: { email: "budi@example.com", password: "Rahasia123" } }]]);
    expect(tokenStorage.setTokens).toHaveBeenCalledWith(TOKENS);
  });

  it("sukses setelah dipantulkan AuthGuard: kembali ke halaman asal (state.from)", async () => {
    renderLogin(undefined, { pathname: "/login", state: { from: "/learn/l-1" } });

    submit();

    await waitFor(() => expect(screen.getByTestId("destination-path").textContent).toBe("/learn/l-1"));
  });

  it("selama menunggu server: tombol 'Memproses...' nonaktif", async () => {
    let finish: (value: { data: unknown }) => void = () => {};
    renderLogin(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    submit();

    const busy = (await screen.findByRole("button", { name: "Memproses..." })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    finish({ data: TOKENS });
    await waitFor(() => expect(screen.getByTestId("destination-path").textContent).toBe("/"));
  });

  it("401 (kredensial salah): 'Email atau password salah.' dan tidak ada token tersimpan", async () => {
    renderLogin(() => ({ error: { statusCode: 401, message: "Email atau password salah" }, status: 401 }));

    submit();

    await waitFor(() => expect(alertText()).toBe(INVALID_CREDENTIALS_TEXT));
    expect(tokenStorage.setTokens).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Masuk" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("403 (akun terkunci 5x gagal): tampilkan pesan kunci dari server, BUKAN 'password salah'", async () => {
    renderLogin(() => ({ error: { statusCode: 403, message: LOCKOUT_MESSAGE }, status: 403 }));

    submit();

    await waitFor(() => expect(alertText()).toBe(LOCKOUT_MESSAGE));
    expect(document.body.textContent).not.toContain(INVALID_CREDENTIALS_TEXT);
  });

  it("400 validasi (message array, Inggris): tetap 'Email atau password salah.', tanpa bocor pesan mentah", async () => {
    renderLogin(() => ({ error: { statusCode: 400, message: ["email must be an email"] }, status: 400 }));

    submit();

    await waitFor(() => expect(alertText()).toBe(INVALID_CREDENTIALS_TEXT));
    expect(document.body.textContent).not.toContain("must be an email");
  });

  it.each([
    ["429", { error: { statusCode: 429, message: "ThrottlerException: Too Many Requests" }, status: 429 }, "Terlalu banyak percobaan. Coba lagi beberapa saat lagi."],
    ["500", { error: { statusCode: 500, message: "Internal server error" }, status: 500 }, "Terjadi gangguan di server. Coba lagi sebentar lagi."],
  ])("%s: teks ramah yang sesuai, bukan 'password salah'", async (_label, result, text) => {
    renderLogin(() => result);

    submit();

    await waitFor(() => expect(alertText()).toBe(text));
  });

  it("gangguan jaringan: pesan jaringan dan tombol aktif lagi (dulu macet di 'Memproses...')", async () => {
    renderLogin(() => {
      throw new TypeError("Failed to fetch");
    });

    submit();

    await waitFor(() => expect(alertText()).toBe(NETWORK_ERROR_TEXT));
    expect((screen.getByRole("button", { name: "Masuk" }) as HTMLButtonElement).disabled).toBe(false);
    expect(tokenStorage.setTokens).not.toHaveBeenCalled();
  });
});
