import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("gagal menyimpan: pesan galat, context tidak diubah", async () => {
    const { setMe } = renderProfile(makeMe(), () => ({ error: { statusCode: 500, message: "Internal server error" }, status: 500 }));

    save();

    await waitFor(() => expect(screen.getByText("Gagal menyimpan perubahan.")).toBeTruthy());
    expect(setMe).not.toHaveBeenCalled();
    expect(screen.queryByText("Perubahan tersimpan.")).toBeNull();
  });
});
