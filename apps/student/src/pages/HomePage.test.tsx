import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../test/api-mock";
import { makeMe, renderAuthedPage } from "../test/render";
import { KANA_PATH } from "../lib/kana";
import { HomePage } from "./HomePage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

const lesson = (id: string, state: "locked" | "available" | "done") => ({ id, title: id, state, stars: state === "done" ? 3 : null, isCheckpoint: false });

function pathWith({ done }: { done: number }) {
  return {
    levels: [
      {
        id: "lv1",
        code: "N5",
        name: "Hiragana",
        order: 1,
        units: [
          {
            id: "unit_hiragana",
            type: "kana",
            title: "Hiragana",
            order: 1,
            unlocked: true,
            completedLessons: done,
            totalLessons: 2,
            lessons: [lesson("l1", done > 0 ? "done" : "available"), lesson("l2", done > 0 ? "available" : "locked")],
          },
          {
            id: "unit_kerja_3",
            type: "conversation",
            title: "Percakapan di Tempat Kerja",
            order: 3,
            unlocked: false,
            completedLessons: 0,
            totalLessons: 1,
            lessons: [lesson("k3_l1", "locked")],
          },
        ],
      },
    ],
    continueLessonId: done > 0 ? "l2" : "l1",
    streak: { current: 0, longest: 0 },
  };
}

const PLACEMENT_NONE = { enabled: true, available: false, questionCount: 15, passPercent: 80, sections: [], result: null };
const PLACEMENT_OFFER = { ...PLACEMENT_NONE, available: true, sections: [{ id: "unit_hiragana", title: "Hiragana", levelName: "Hiragana" }] };

function renderHome(done: number, { placement = PLACEMENT_NONE, path = pathWith({ done }) }: { placement?: object; path?: object } = {}) {
  mockApi({ GET: { "/path": () => ({ data: path }), "/placement": () => ({ data: placement }) } });
  return renderAuthedPage(<HomePage />, makeMe(), { path: "/", entry: "/", destinations: [KANA_PATH, "/learn/:lessonId", "/placement"] });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("HomePage: jalan masuk ke pengantar dan tabel kana", () => {
  it("murid yang belum menyelesaikan satu pelajaran pun melihat kartu pengantar", async () => {
    renderHome(0);

    expect(await screen.findByTestId("kana-intro-card")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Baca pengantar" }));
    expect(screen.getByTestId("destination-path").textContent).toBe(KANA_PATH);
  });

  it("kartu pengantar tidak tampil lagi setelah ada pelajaran yang selesai", async () => {
    renderHome(1);

    await screen.findByText("Percakapan di Tempat Kerja");
    expect(screen.queryByTestId("kana-intro-card")).toBeNull();
  });

  it("hanya unit kana yang punya tautan ke tabel huruf", async () => {
    renderHome(1);

    const links = await screen.findAllByTestId("unit-kana-chart");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toBe(`${KANA_PATH}?tab=hiragana`);
  });
});

describe("HomePage: tes penempatan (AUTH-05)", () => {
  it("selama tersedia: kartu tawaran menyebut bagian yang bisa dilewati dan membuka /placement", async () => {
    renderHome(0, { placement: PLACEMENT_OFFER });

    const card = await screen.findByTestId("placement-offer-card");
    expect(card.textContent).toContain("Sudah bisa membaca Hiragana?");
    expect(card.textContent).toContain("15 soal");
    fireEvent.click(screen.getByRole("link", { name: "Ikut tes" }));
    expect(screen.getByTestId("destination-path").textContent).toBe("/placement");
  });

  it("tidak tersedia: tanpa kartu tawaran", async () => {
    renderHome(0);

    await screen.findByTestId("kana-intro-card");
    expect(screen.queryByTestId("placement-offer-card")).toBeNull();
  });

  it("status tes gagal dimuat: Beranda tetap tampil tanpa tawaran", async () => {
    mockApi({ GET: { "/path": () => ({ data: pathWith({ done: 0 }) }), "/placement": () => ({ error: { message: "x" }, status: 500 }) } });
    renderAuthedPage(<HomePage />, makeMe(), { path: "/", entry: "/" });

    await screen.findByTestId("kana-intro-card");
    expect(screen.queryByTestId("placement-offer-card")).toBeNull();
  });

  it("unit yang dilewati diberi tanda; pengantar huruf tidak ditawarkan lagi", async () => {
    const base = pathWith({ done: 0 });
    const [hiragana, kerja] = base.levels[0]!.units;
    const path = {
      ...base,
      levels: [{ ...base.levels[0]!, units: [{ ...hiragana!, skipped: true }, { ...kerja!, unlocked: true, skipped: false, lessons: [lesson("k3_l1", "available")] }] }],
      continueLessonId: "k3_l1",
    };
    renderHome(0, { path });

    const chips = await screen.findAllByTestId("unit-skipped");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.closest("div")!.textContent).toContain("Hiragana");
    expect(chips[0]!.textContent).toContain("Dilewati lewat tes penempatan");
    expect(screen.queryByTestId("kana-intro-card")).toBeNull();
  });
});
