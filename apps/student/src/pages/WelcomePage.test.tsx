import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NETWORK_ERROR_TEXT } from "../auth/api-errors";
import { callsTo, mockApi, type MockHandler } from "../test/api-mock";
import { makeMe, renderAuthedPage } from "../test/render";
import type { Me } from "../auth/AuthContext";
import { WelcomePage } from "./WelcomePage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

const PATH = "/path";
const ME = "/me";

const unit = (id: string, totalLessons: number) => ({
  id,
  type: "kana",
  title: id,
  order: 1,
  unlocked: true,
  completedLessons: 0,
  totalLessons,
  lessons: [],
});

const LEARNING_PATH = {
  levels: [
    { id: "l1", code: "HIRAGANA", name: "Hiragana", order: 1, units: [unit("u1", 3), unit("u2", 2)] },
    { id: "l2", code: "KATAKANA", name: "Katakana", order: 2, units: [unit("u3", 4)] },
  ],
  continueLessonId: null,
  streak: { current: 0, longest: 0 },
};

interface Options {
  me?: Me;
  path?: MockHandler;
  patchMe?: MockHandler;
}

function renderWelcome({ me = makeMe(), path = () => ({ data: LEARNING_PATH }), patchMe }: Options = {}) {
  mockApi({ GET: { [PATH]: path }, ...(patchMe ? { PATCH: { [ME]: patchMe } } : {}) });
  return renderAuthedPage(<WelcomePage />, me, { path: "/welcome", entry: "/welcome", destinations: ["/"] });
}

function selectedGoal() {
  const radios = screen.getAllByRole("radio") as HTMLInputElement[];
  return radios.find((radio) => radio.checked)?.value;
}

function next() {
  fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
}

function progress() {
  return screen.getByTestId("welcome-progress").textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WelcomePage -- langkah 1: target harian", () => {
  it("menyapa dengan nama depan, menyebut kelas, dan menandai langkah 1 dari 3", () => {
    renderWelcome({ me: makeMe({ name: "Budi Santoso Putra", className: "Kelas Katakana Sore" }) });

    expect(screen.getByRole("heading", { level: 1, name: "Selamat datang, Budi!" })).toBeTruthy();
    expect(screen.getByText("Kelas Katakana Sore")).toBeTruthy();
    expect(progress()).toBe("Langkah 1 dari 3");
  });

  it("nama satu kata dan spasi berlebih tetap menghasilkan sapaan yang benar", () => {
    renderWelcome({ me: makeMe({ name: "  Sakura  " }) });

    expect(screen.getByRole("heading", { level: 1, name: "Selamat datang, Sakura!" })).toBeTruthy();
  });

  it("menawarkan 10/30/50 XP dengan nama tingkat, target saat ini terpilih", () => {
    renderWelcome({ me: makeMe({ dailyXpGoal: 50 }) });

    expect(screen.getAllByRole("radio").map((radio) => (radio as HTMLInputElement).value)).toEqual(["10", "30", "50"]);
    expect(screen.getByText("10 XP -- Santai")).toBeTruthy();
    expect(screen.getByText("30 XP -- Reguler")).toBeTruthy();
    expect(screen.getByText("50 XP -- Serius")).toBeTruthy();
    expect(selectedGoal()).toBe("50");
  });

  it("target di luar pilihan (data lama) -> bawaan 30, bukan tanpa pilihan", () => {
    renderWelcome({ me: makeMe({ dailyXpGoal: 20 }) });

    expect(selectedGoal()).toBe("30");
  });

  it("target tidak diubah: lanjut TANPA request simpan", async () => {
    renderWelcome({ me: makeMe({ dailyXpGoal: 30 }), patchMe: () => ({ data: makeMe() }) });

    next();

    expect(await screen.findByRole("heading", { level: 1, name: "Jalur belajarmu" })).toBeTruthy();
    expect(callsTo("PATCH", ME)).toHaveLength(0);
  });

  it("target diubah: simpan lewat PATCH /me (hanya dailyXpGoal), perbarui context, lalu lanjut", async () => {
    const saved = makeMe({ dailyXpGoal: 50 });
    const { setMe } = renderWelcome({ me: makeMe({ dailyXpGoal: 30 }), patchMe: () => ({ data: saved }) });

    fireEvent.click(screen.getByLabelText(/50 XP/));
    expect(selectedGoal()).toBe("50");
    next();

    expect(await screen.findByRole("heading", { level: 1, name: "Jalur belajarmu" })).toBeTruthy();
    expect(callsTo("PATCH", ME)).toEqual([[ME, { body: { dailyXpGoal: 50 } }]]);
    expect(setMe).toHaveBeenCalledWith(saved);
  });

  it("selama menyimpan: tombol 'Menyimpan...' nonaktif", async () => {
    let finish: (value: { data: unknown }) => void = () => {};
    renderWelcome({
      patchMe: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });

    fireEvent.click(screen.getByLabelText(/10 XP/));
    next();

    const busy = (await screen.findByRole("button", { name: "Menyimpan..." })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    finish({ data: makeMe({ dailyXpGoal: 10 }) });
    expect(await screen.findByRole("heading", { level: 1, name: "Jalur belajarmu" })).toBeTruthy();
  });

  it("gagal menyimpan (400): tetap di langkah 1 dengan pesan, context TIDAK diubah", async () => {
    const { setMe } = renderWelcome({
      patchMe: () => ({ error: { statusCode: 400, message: ["dailyXpGoal must be one of the following values: 10, 30, 50"] }, status: 400 }),
    });

    fireEvent.click(screen.getByLabelText(/50 XP/));
    next();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Data yang dikirim tidak valid. Periksa kembali isianmu."));
    expect(progress()).toBe("Langkah 1 dari 3");
    expect(setMe).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Lanjut" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("gangguan jaringan saat menyimpan: pesan jaringan, tetap di langkah 1, tombol aktif lagi", async () => {
    renderWelcome({
      patchMe: () => {
        throw new TypeError("Failed to fetch");
      },
    });

    fireEvent.click(screen.getByLabelText(/50 XP/));
    next();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(NETWORK_ERROR_TEXT));
    expect(progress()).toBe("Langkah 1 dari 3");
    expect((screen.getByRole("button", { name: "Lanjut" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("WelcomePage -- langkah 2: jalur belajar", () => {
  it("menampilkan level dari jalur kelas: awal jalur ditandai, hitungan unit dan pelajaran benar", async () => {
    renderWelcome();
    next();

    const list = await screen.findByTestId("welcome-levels");
    expect(progress()).toBe("Langkah 2 dari 3");
    const items = Array.from(list.querySelectorAll("li")).map((item) => item.textContent ?? "");
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Hiragana");
    expect(items[0]).toContain("mulai di sini");
    expect(items[0]).toContain("2 unit, 5 pelajaran");
    expect(items[1]).toContain("Katakana");
    expect(items[1]).not.toContain("mulai di sini");
    expect(items[1]).toContain("1 unit, 4 pelajaran");
    expect(screen.getByText(/mulai dari awal jalur, yaitu level/).textContent).toContain("Hiragana");
    expect(callsTo("GET", PATH)).toHaveLength(1);
  });

  it("selagi jalur dimuat: teks memuat, tombol navigasi tetap bisa dipakai", async () => {
    renderWelcome({ path: () => new Promise(() => {}) });
    next();

    expect(await screen.findByText("Memuat jalur belajarmu...")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lanjut" })).toBeTruthy();
  });

  it.each([
    ["server error", () => ({ error: { statusCode: 500, message: "Internal server error" }, status: 500 })],
    [
      "gangguan jaringan",
      () => {
        throw new TypeError("Failed to fetch");
      },
    ],
  ])("jalur gagal dimuat (%s): pesan lembut, onboarding tetap bisa diselesaikan tanpa 'Level awal'", async (_label, path) => {
    renderWelcome({ path });
    next();

    expect(await screen.findByText("Jalur belajarmu akan tampil di Beranda.")).toBeTruthy();
    next();

    expect(await screen.findByRole("heading", { level: 1, name: "Siap mulai!" })).toBeTruthy();
    expect(screen.queryByText("Level awal")).toBeNull();
  });

  it("kelas tanpa level: tidak error, menampilkan '-' dan tanpa 'Level awal' di ringkasan", async () => {
    renderWelcome({ path: () => ({ data: { ...LEARNING_PATH, levels: [] } }) });
    next();

    await screen.findByTestId("welcome-levels");
    expect(screen.getByText(/mulai dari awal jalur, yaitu level/).textContent).toContain("-");
    next();
    expect(await screen.findByRole("heading", { level: 1, name: "Siap mulai!" })).toBeTruthy();
    expect(screen.queryByText("Level awal")).toBeNull();
  });

  it("'Kembali' ke langkah 1 mempertahankan target yang sudah dipilih", async () => {
    renderWelcome({ me: makeMe({ dailyXpGoal: 30 }), patchMe: () => ({ data: makeMe({ dailyXpGoal: 50 }) }) });
    fireEvent.click(screen.getByLabelText(/50 XP/));
    next();
    await screen.findByRole("heading", { level: 1, name: "Jalur belajarmu" });

    fireEvent.click(screen.getByRole("button", { name: "Kembali" }));

    expect(progress()).toBe("Langkah 1 dari 3");
    expect(selectedGoal()).toBe("50");
  });
});

describe("WelcomePage -- langkah 3: mulai", () => {
  it("ringkasan memuat kelas, target terpilih, dan level awal; 'Mulai Belajar' membuka Beranda", async () => {
    renderWelcome({ me: makeMe({ dailyXpGoal: 30, className: "Kelas Hiragana Pagi" }), patchMe: () => ({ data: makeMe({ dailyXpGoal: 50 }) }) });
    fireEvent.click(screen.getByLabelText(/50 XP/));
    next();
    await screen.findByTestId("welcome-levels");
    next();

    expect(await screen.findByRole("heading", { level: 1, name: "Siap mulai!" })).toBeTruthy();
    expect(progress()).toBe("Langkah 3 dari 3");
    expect(screen.getByTestId("welcome-summary-goal").textContent).toBe("50 XP");
    const summary = screen.getByText("Kelas").closest("dl")?.textContent ?? "";
    expect(summary).toContain("Kelas Hiragana Pagi");
    expect(summary).toContain("Level awal");
    expect(summary).toContain("Hiragana");

    fireEvent.click(screen.getByRole("button", { name: "Mulai Belajar" }));

    expect(screen.getByTestId("destination-path").textContent).toBe("/");
  });

  it("'Kembali' dari langkah 3 ke langkah 2", async () => {
    renderWelcome();
    next();
    await screen.findByTestId("welcome-levels");
    next();
    await screen.findByRole("heading", { level: 1, name: "Siap mulai!" });

    fireEvent.click(screen.getByRole("button", { name: "Kembali" }));

    expect(screen.getByRole("heading", { level: 1, name: "Jalur belajarmu" })).toBeTruthy();
    expect(progress()).toBe("Langkah 2 dari 3");
  });
});
