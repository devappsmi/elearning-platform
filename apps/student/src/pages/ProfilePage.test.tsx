import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NETWORK_ERROR_TEXT } from "../auth/api-errors";
import { callsTo, mockApi, type MockHandler } from "../test/api-mock";
import { makeMe, renderAuthedPage } from "../test/render";
import type { Me } from "../auth/AuthContext";
import { ProfilePage } from "./ProfilePage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

const ME = "/me";

function renderProfile(me: Me = makeMe(), patchMe: MockHandler = () => ({ data: me })) {
  mockApi({ PATCH: { [ME]: patchMe } });
  return renderAuthedPage(<ProfilePage />, me, { path: "/profile", entry: "/profile" });
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfilePage", () => {
  it("Info Akun memuat email dan KELAS murid (dari /me)", () => {
    renderProfile(makeMe({ email: "budi@example.com", className: "Kelas Hiragana Pagi" }));

    expect(screen.getByText("budi@example.com")).toBeTruthy();
    expect(screen.getByTestId("profile-class").textContent).toBe("Kelas Hiragana Pagi");
  });

  it("form terisi dari akun: nama dan target XP saat ini", () => {
    renderProfile(makeMe({ name: "Budi Santoso", dailyXpGoal: 50 }));

    expect((screen.getByLabelText("Nama") as HTMLInputElement).value).toBe("Budi Santoso");
    expect((screen.getByLabelText("Target XP Harian") as HTMLSelectElement).value).toBe("50");
  });

  it("nama hanya spasi -> 'Nama tidak boleh kosong.' dan TIDAK ada request", () => {
    renderProfile();

    fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "    " } });
    save();

    expect(screen.getByText("Nama tidak boleh kosong.")).toBeTruthy();
    expect(callsTo("PATCH", ME)).toHaveLength(0);
  });

  it("simpan: kirim nama terpangkas + target, perbarui context, tampilkan nama yang tersimpan", async () => {
    const stored = makeMe({ name: "Budi Baru", dailyXpGoal: 50 });
    const { setMe } = renderProfile(makeMe({ name: "Budi Lama", dailyXpGoal: 30 }), () => ({ data: stored }));

    fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "  Budi Baru  " } });
    fireEvent.change(screen.getByLabelText("Target XP Harian"), { target: { value: "50" } });
    save();

    expect(await screen.findByText("Perubahan tersimpan.")).toBeTruthy();
    expect(callsTo("PATCH", ME)).toEqual([[ME, { body: { name: "Budi Baru", dailyXpGoal: 50 } }]]);
    expect(setMe).toHaveBeenCalledWith(stored);
    expect((screen.getByLabelText("Nama") as HTMLInputElement).value).toBe("Budi Baru");
  });

  it.each([
    ["500", { error: { statusCode: 500, message: "Internal server error" }, status: 500 }, "Terjadi gangguan di server. Coba lagi sebentar lagi."],
    ["429", { error: { statusCode: 429, message: "ThrottlerException: Too Many Requests" }, status: 429 }, "Terlalu banyak percobaan. Coba lagi beberapa saat lagi."],
    ["400 validasi (Inggris, array)", { error: { statusCode: 400, message: ["name must be a string"] }, status: 400 }, "Gagal menyimpan perubahan."],
    ["400 pesan bisnis (string)", { error: { statusCode: 400, message: "Nama sudah dipakai murid lain" }, status: 400 }, "Nama sudah dipakai murid lain"],
  ])("gagal menyimpan (%s): pesan yang sesuai, context tidak diubah, tombol aktif lagi", async (_label, result, text) => {
    const { setMe } = renderProfile(makeMe(), () => result);

    save();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(text));
    expect(document.body.textContent).not.toContain("Throttler");
    expect(document.body.textContent).not.toContain("must be a string");
    expect(setMe).not.toHaveBeenCalled();
    expect(screen.queryByText("Perubahan tersimpan.")).toBeNull();
    expect((screen.getByRole("button", { name: "Simpan Perubahan" }) as HTMLButtonElement).disabled).toBe(false);
  });

  // Dulu fetch yang melempar (jaringan putus) membuat tombol macet di "Menyimpan..." tanpa pesan apa pun.
  it("gangguan jaringan: pesan jaringan, tombol aktif lagi (tidak macet), context tidak diubah", async () => {
    const { setMe } = renderProfile(makeMe(), () => {
      throw new TypeError("Failed to fetch");
    });

    save();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(NETWORK_ERROR_TEXT));
    expect((screen.getByRole("button", { name: "Simpan Perubahan" }) as HTMLButtonElement).disabled).toBe(false);
    expect(setMe).not.toHaveBeenCalled();
  });

  it("mencoba lagi setelah gangguan jaringan: pesan galat lama hilang dan penyimpanan berhasil", async () => {
    let attempt = 0;
    const stored = makeMe({ name: "Budi Baru" });
    renderProfile(makeMe(), () => {
      attempt += 1;
      if (attempt === 1) throw new TypeError("Failed to fetch");
      return { data: stored };
    });

    save();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(NETWORK_ERROR_TEXT));
    save();

    expect(await screen.findByText("Perubahan tersimpan.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull(); // pesan galat sebelumnya dibersihkan
    expect(callsTo("PATCH", ME)).toHaveLength(2);
  });
});
