import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStorage } from "../auth/api-client";
import { INVALID_INPUT_TEXT, NETWORK_ERROR_TEXT } from "../auth/api-errors";
import { callsTo, mockApi, type MockHandler } from "../test/api-mock";
import { renderPage } from "../test/render";
import { AcceptInvitationPage } from "./AcceptInvitationPage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

const TOKEN = "tok-123";
const VALIDATE = "/auth/invitations/validate";
const REGISTER = "/auth/register";
const REQUEST_RESEND = "/auth/invitations/{token}/request-resend";

const VALID = {
  reason: "VALID",
  invitationId: "inv-1",
  name: "Budi Santoso",
  email: "budi@example.com",
  className: "Kelas Hiragana Pagi",
  institutionName: "Sakura Gakuin",
};

interface Handlers {
  validate: MockHandler;
  register?: MockHandler;
  requestResend?: MockHandler;
}

function renderInvitation({ validate, register, requestResend }: Handlers) {
  mockApi({
    POST: {
      [VALIDATE]: validate,
      ...(register ? { [REGISTER]: register } : {}),
      ...(requestResend ? { [REQUEST_RESEND]: requestResend } : {}),
    },
  });
  return renderPage(<AcceptInvitationPage />, {
    path: "/invite/:token",
    entry: `/invite/${TOKEN}`,
    destinations: ["/welcome", "/login"],
  });
}

const validInvitation: MockHandler = () => ({ data: VALID });

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Buat Akun" }));
}

/** Mengisi form dengan data yang lolos validasi klien, lalu mengirim. */
async function fillAndSubmit(over: { name?: string; password?: string; confirmation?: string } = {}) {
  await screen.findByRole("button", { name: "Buat Akun" });
  fill("Nama lengkap", over.name ?? "Budi Santoso");
  fill("Password", over.password ?? "Rahasia123");
  fill("Konfirmasi password", over.confirmation ?? over.password ?? "Rahasia123");
  submit();
}

function alertText() {
  return screen.getByRole("alert").textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AcceptInvitationPage -- token VALID", () => {
  it("memeriksa token ke server lalu menampilkan form berisi data undangan", async () => {
    renderInvitation({ validate: validInvitation });

    expect(screen.getByText("Memeriksa undangan...")).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 1, name: "Selamat datang di Sakura Gakuin" })).toBeTruthy();

    expect(callsTo("POST", VALIDATE)).toEqual([[VALIDATE, { body: { token: TOKEN } }]]);
    expect(screen.getByText("Kelas Hiragana Pagi")).toBeTruthy();
    expect((screen.getByLabelText("Nama lengkap") as HTMLInputElement).value).toBe("Budi Santoso");
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    expect(email.value).toBe("budi@example.com");
    expect(email.readOnly).toBe(true);
    expect(screen.getByText("Minimal 8 karakter, mengandung huruf dan angka.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Masuk" }).getAttribute("href")).toBe("/login");
  });

  it("tanpa data lembaga: judul tetap ramah ('Selamat datang'), bukan 'di null'", async () => {
    renderInvitation({ validate: () => ({ data: { ...VALID, institutionName: null } }) });

    expect(await screen.findByRole("heading", { level: 1, name: "Selamat datang" })).toBeTruthy();
  });

  it.each([
    ["nama hanya spasi", { name: "   " }, "Nama lengkap wajib diisi."],
    ["password terlalu pendek", { password: "abc12" }, "Password minimal 8 karakter."],
    ["password tanpa angka", { password: "abcdefgh" }, "Password harus mengandung huruf dan angka."],
    ["password tanpa huruf", { password: "12345678" }, "Password harus mengandung huruf dan angka."],
    ["konfirmasi tidak sama", { password: "Rahasia123", confirmation: "Rahasia124" }, "Konfirmasi password tidak sama."],
  ])("validasi klien: %s -> pesan jelas dan TIDAK ada request registrasi", async (_label, input, message) => {
    renderInvitation({ validate: validInvitation, register: () => ({ data: {} }) });

    await fillAndSubmit(input);

    expect(alertText()).toBe(message);
    expect(callsTo("POST", REGISTER)).toHaveLength(0);
  });

  it("sukses: kirim {token, nama terpangkas, password} SAJA, simpan token, lanjut ke /welcome", async () => {
    const tokens = { accessToken: "access-1", refreshToken: "refresh-1" };
    renderInvitation({ validate: validInvitation, register: () => ({ data: tokens }) });

    await fillAndSubmit({ name: "  Budi S.  ", password: "Rahasia123" });

    await waitFor(() => expect(screen.getByTestId("destination-path").textContent).toBe("/welcome"));
    // Server menurunkan email/kelas dari undangan -- klien tidak boleh mengirimnya.
    expect(callsTo("POST", REGISTER)).toEqual([[REGISTER, { body: { token: TOKEN, name: "Budi S.", password: "Rahasia123" } }]]);
    expect(tokenStorage.setTokens).toHaveBeenCalledWith(tokens);
  });

  it("selama menunggu server: tombol 'Memproses...' nonaktif (tidak bisa kirim ganda)", async () => {
    let finish: (value: { data: unknown }) => void = () => {};
    const pending = new Promise<{ data: unknown }>((resolve) => {
      finish = resolve;
    });
    renderInvitation({ validate: validInvitation, register: () => pending });

    await fillAndSubmit();

    const busy = (await screen.findByRole("button", { name: "Memproses..." })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    fireEvent.click(busy);
    expect(callsTo("POST", REGISTER)).toHaveLength(1);

    finish({ data: { accessToken: "a", refreshToken: "r" } });
    await waitFor(() => expect(screen.getByTestId("destination-path").textContent).toBe("/welcome"));
  });

  it("400 dengan pesan bisnis (undangan berubah sejak dibuka): periksa ulang lalu tampilkan halaman yang sesuai", async () => {
    const validate = vi
      .fn<MockHandler>()
      .mockReturnValueOnce({ data: VALID })
      .mockReturnValueOnce({ data: { reason: "EXPIRED" } });
    renderInvitation({
      validate,
      register: () => ({ error: { statusCode: 400, message: "Undangan sudah kedaluwarsa" }, status: 400 }),
    });

    await fillAndSubmit();

    expect(await screen.findByRole("heading", { level: 1, name: "Undangan sudah kedaluwarsa" })).toBeTruthy();
    expect(callsTo("POST", VALIDATE)).toHaveLength(2);
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("400 pesan bisnis tetapi undangan MASIH valid: form bertahan dan menampilkan pesan server", async () => {
    renderInvitation({
      validate: validInvitation,
      register: () => ({ error: { statusCode: 400, message: "Email sudah terdaftar" }, status: 400 }),
    });

    await fillAndSubmit();

    await waitFor(() => expect(alertText()).toBe("Email sudah terdaftar"));
    expect(callsTo("POST", VALIDATE)).toHaveLength(2); // periksa ulang tetap terjadi...
    expect(screen.getByLabelText("Password")).toBeTruthy(); // ...tetapi form tidak diganti
    expect((screen.getByRole("button", { name: "Buat Akun" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("400 validasi (message array, Inggris): tampilkan teks Indonesia tetap, jangan bocorkan pesan mentah, tanpa periksa ulang", async () => {
    renderInvitation({
      validate: validInvitation,
      register: () => ({ error: { statusCode: 400, message: ["password must be longer than or equal to 8 characters"] }, status: 400 }),
    });

    await fillAndSubmit();

    await waitFor(() => expect(alertText()).toBe(INVALID_INPUT_TEXT));
    expect(document.body.textContent).not.toContain("must be longer");
    expect(callsTo("POST", VALIDATE)).toHaveLength(1);
  });

  it("429 (dibatasi): pesan terlalu banyak percobaan, form tetap bisa dicoba lagi", async () => {
    renderInvitation({ validate: validInvitation, register: () => ({ error: { statusCode: 429, message: "ThrottlerException: Too Many Requests" }, status: 429 }) });

    await fillAndSubmit();

    await waitFor(() => expect(alertText()).toBe("Terlalu banyak percobaan. Coba lagi beberapa saat lagi."));
    expect(document.body.textContent).not.toContain("Throttler");
    expect((screen.getByRole("button", { name: "Buat Akun" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("gangguan jaringan saat mengirim: pesan jaringan dan tombol aktif lagi (tidak macet)", async () => {
    renderInvitation({
      validate: validInvitation,
      register: () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await fillAndSubmit();

    await waitFor(() => expect(alertText()).toBe(NETWORK_ERROR_TEXT));
    expect((screen.getByRole("button", { name: "Buat Akun" }) as HTMLButtonElement).disabled).toBe(false);
    expect(tokenStorage.setTokens).not.toHaveBeenCalled();
  });
});

describe("AcceptInvitationPage -- token tidak bisa dipakai", () => {
  it.each([
    ["NOT_FOUND", "Tautan undangan tidak valid"],
    ["REVOKED", "Undangan sudah dicabut"],
    ["ALREADY_ACCEPTED", "Undangan sudah dipakai"],
    ["EXPIRED", "Undangan sudah kedaluwarsa"],
  ])("%s -> halaman '%s', tanpa form registrasi", async (reason, title) => {
    renderInvitation({ validate: () => ({ data: { reason } }) });

    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeTruthy();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByRole("button", { name: "Buat Akun" })).toBeNull();
  });

  it.each([["NOT_FOUND"], ["REVOKED"], ["ALREADY_ACCEPTED"]])(
    "%s: TIDAK ada tombol 'Minta undangan ulang' (tidak ada siapa yang bisa dinotifikasi / sengaja dicabut / sudah dipakai)",
    async (reason) => {
      renderInvitation({ validate: () => ({ data: { reason } }) });

      await screen.findByRole("heading", { level: 1 });
      expect(screen.queryByRole("button", { name: "Minta undangan ulang" })).toBeNull();
    },
  );

  it("ALREADY_ACCEPTED: menawarkan tombol Masuk ke /login", async () => {
    renderInvitation({ validate: () => ({ data: { reason: "ALREADY_ACCEPTED" } }) });

    await screen.findByRole("heading", { level: 1, name: "Undangan sudah dipakai" });

    const links = screen.getAllByRole("link", { name: "Masuk" });
    expect(links.length).toBeGreaterThanOrEqual(2); // tombol utama + tautan footer
    for (const link of links) expect(link.getAttribute("href")).toBe("/login");
  });

  it("tidak membocorkan detail undangan pada status tak berlaku", async () => {
    renderInvitation({ validate: () => ({ data: { reason: "EXPIRED" } }) });

    await screen.findByRole("heading", { level: 1, name: "Undangan sudah kedaluwarsa" });
    expect(document.body.textContent).not.toContain("budi@example.com");
    expect(document.body.textContent).not.toContain("Sakura Gakuin");
  });

  it("EXPIRED: 'Minta undangan ulang' memanggil endpoint dengan token dari URL lalu menampilkan konfirmasi", async () => {
    renderInvitation({
      validate: () => ({ data: { reason: "EXPIRED" } }),
      requestResend: () => ({ data: { message: "ok" } }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Minta undangan ulang" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Permintaan sudah diteruskan ke admin lembaga kamu");
    expect(callsTo("POST", REQUEST_RESEND)).toEqual([[REQUEST_RESEND, { params: { path: { token: TOKEN } } }]]);
    expect(screen.queryByRole("button", { name: "Minta undangan ulang" })).toBeNull(); // tidak bisa menekan dua kali
  });

  it("EXPIRED: permintaan ulang dibatasi (429) -> pesan jelas dan tombol tetap ada untuk dicoba lagi nanti", async () => {
    renderInvitation({
      validate: () => ({ data: { reason: "EXPIRED" } }),
      requestResend: () => ({ error: { statusCode: 429, message: "ThrottlerException: Too Many Requests" }, status: 429 }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Minta undangan ulang" }));

    await waitFor(() => expect(alertText()).toBe("Terlalu banyak percobaan. Coba lagi beberapa saat lagi."));
    expect(screen.getByRole("button", { name: "Minta undangan ulang" })).toBeTruthy();
  });

  it("EXPIRED: gangguan jaringan saat meminta ulang -> pesan jaringan", async () => {
    renderInvitation({
      validate: () => ({ data: { reason: "EXPIRED" } }),
      requestResend: () => {
        throw new TypeError("Failed to fetch");
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Minta undangan ulang" }));

    await waitFor(() => expect(alertText()).toBe(NETWORK_ERROR_TEXT));
  });
});

describe("AcceptInvitationPage -- server tidak terjangkau", () => {
  it("gangguan jaringan saat memeriksa token: pesan + 'Coba Lagi' yang memeriksa ulang dan membuka form", async () => {
    const validate = vi
      .fn<MockHandler>()
      .mockImplementationOnce(() => {
        throw new TypeError("Failed to fetch");
      })
      .mockReturnValueOnce({ data: VALID });
    renderInvitation({ validate });

    await waitFor(() => expect(alertText()).toBe(NETWORK_ERROR_TEXT));
    expect(screen.queryByLabelText("Password")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Coba Lagi" }));

    expect(await screen.findByRole("button", { name: "Buat Akun" })).toBeTruthy();
    expect(callsTo("POST", VALIDATE)).toHaveLength(2);
  });

  it("server membalas error 500 tanpa data -> diperlakukan sebagai tidak terjangkau, bukan 'undangan tidak valid'", async () => {
    renderInvitation({ validate: () => ({ error: { statusCode: 500, message: "Internal server error" }, status: 500 }) });

    await waitFor(() => expect(alertText()).toBe(NETWORK_ERROR_TEXT));
    expect(screen.queryByRole("heading", { name: "Tautan undangan tidak valid" })).toBeNull();
  });

  it("VALID tetapi detail tidak lengkap -> tidak menampilkan form setengah kosong", async () => {
    renderInvitation({ validate: () => ({ data: { reason: "VALID", invitationId: "inv-1" } }) });

    await waitFor(() => expect(alertText()).toBe(NETWORK_ERROR_TEXT));
    expect(screen.queryByLabelText("Password")).toBeNull();
  });
});
