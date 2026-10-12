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

function renderHome(done: number) {
  mockApi({ GET: { "/path": () => ({ data: pathWith({ done }) }) } });
  return renderAuthedPage(<HomePage />, makeMe(), { path: "/", entry: "/", destinations: [KANA_PATH, "/learn/:lessonId"] });
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
