import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../test/api-mock";
import { renderPage } from "../test/render";
import { TUTOR_PATH } from "../lib/tutor-chat";
import { ConversationCatalogPage } from "./ConversationCatalogPage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

const SCENARIO = {
  id: "perkenalan",
  titleJp: "自己紹介",
  titleId: "Perkenalan Diri",
  level: "N5",
  roles: ["classmate", "new_student"],
  estimatedMinutes: 3,
};

function renderCatalog(scenarios: () => { data?: unknown; error?: unknown; status?: number }) {
  mockApi({ GET: { "/scenarios": scenarios } });
  return renderPage(<ConversationCatalogPage />, {
    path: "/conversation",
    entry: "/conversation",
    destinations: [TUTOR_PATH, "/conversation/:id"],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("ConversationCatalogPage", () => {
  it("kartu 'Ngobrol dengan AI' tampil bersama skenario yang ada", async () => {
    renderCatalog(() => ({ data: [SCENARIO] }));

    expect(await screen.findByText("自己紹介")).toBeTruthy();
    expect(screen.getByText("Ngobrol dengan AI")).toBeTruthy();
    expect(screen.getByText("Bicara bebas lewat suara. AI membalas dan membetulkan kalimatmu.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Skenario latihan" })).toBeTruthy();
  });

  it("kartu itu menuju layar Ngobrol dengan AI", async () => {
    renderCatalog(() => ({ data: [SCENARIO] }));

    fireEvent.click(await screen.findByTestId("open-ai-chat"));

    expect(screen.getByTestId("destination-path").textContent).toBe(TUTOR_PATH);
  });

  it("skenario tetap menuju halamannya sendiri", async () => {
    renderCatalog(() => ({ data: [SCENARIO] }));

    fireEvent.click(await screen.findByText("自己紹介"));

    expect(screen.getByTestId("destination-path").textContent).toBe("/conversation/perkenalan");
  });

  it("gagal memuat skenario: pesan galat di bagian skenario, kartu AI tetap bisa dipakai", async () => {
    renderCatalog(() => ({ error: { statusCode: 500 }, status: 500 }));

    expect((await screen.findByRole("alert")).textContent).toBe("Gagal memuat daftar skenario.");
    expect(screen.getByTestId("open-ai-chat")).toBeTruthy();
  });

  it("belum ada skenario: pesan kosong, kartu AI tetap ada", async () => {
    renderCatalog(() => ({ data: [] }));

    expect(await screen.findByText("Belum ada skenario percakapan tersedia.")).toBeTruthy();
    expect(screen.getByTestId("open-ai-chat")).toBeTruthy();
  });

  it("selagi memuat: kartu AI sudah tampil, daftar skenario menunggu", () => {
    renderCatalog(() => new Promise(() => {}) as never);

    expect(screen.getByTestId("open-ai-chat")).toBeTruthy();
    expect(screen.getByText("Memuat...")).toBeTruthy();
  });
});
