import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scenarioContentSchema } from "@elearning/domain";
import { mockApi } from "../test/api-mock";
import { renderPage } from "../test/render";
import { ConversationPage } from "./ConversationPage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

// Bentuk mentah seperti JSON konten; API mengirim hasil parse skema domain, jadi tes ini memakai skema yang sama.
const RAW = {
  scenario_id: "perkenalan",
  title: { id: "Perkenalan Diri", jp: "自己紹介" },
  level: "N5",
  roles: ["classmate", "new_student"],
  estimated_minutes: 3,
  lines: [
    { speaker: "classmate", jp: "お名前は何ですか。", furigana: "お{名前|なまえ}は{何|なん}ですか。", romaji: "onamae wa nan desu ka.", id: "Siapa nama Anda?" },
    {
      speaker: "new_student",
      type: "choice",
      options: [
        { jp: "わたしの名前はアニです。", furigana: "わたしの{名前|なまえ}はアニです。", correct: true },
        { jp: "さようなら。", correct: false, feedback_id: "Itu salam berpisah." },
      ],
    },
  ],
  vocab: [],
  grammar_notes: [],
};
const DETAIL = { id: "perkenalan", titleJp: "自己紹介", titleId: "Perkenalan Diri", level: "N5", content: scenarioContentSchema.parse(RAW) };

async function start(mode: "practice" | "test") {
  mockApi({ GET: { "/scenarios/{id}": () => ({ data: DETAIL }) } });
  renderPage(<ConversationPage />, {
    path: "/conversation/:id",
    entry: "/conversation/perkenalan",
    destinations: ["/conversation", "/conversation/:id/result"],
  });
  fireEvent.click(await screen.findByTestId(mode === "practice" ? "start-practice" : "start-test"));
  await screen.findByTestId("narration-line");
}

const toggle = (key: string) => screen.queryByTestId(`toggle-${key}`) as HTMLButtonElement | null;
const readings = (el: HTMLElement) => Array.from(el.querySelectorAll("rt")).map((rt) => rt.textContent);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("ConversationPage: bantuan membaca (PRD CONV-03/04)", () => {
  it("Latihan: romaji dan arti tersembunyi secara bawaan, tombolnya menampilkan dan menyembunyikan lagi", async () => {
    await start("practice");

    expect(screen.queryByTestId("line-romaji")).toBeNull();
    expect(screen.queryByTestId("line-meaning")).toBeNull();
    expect(toggle("romaji")!.getAttribute("aria-pressed")).toBe("false");
    expect(toggle("meaning")!.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle("romaji")!);
    expect(screen.getByTestId("line-romaji").textContent).toBe("onamae wa nan desu ka.");
    expect(toggle("romaji")!.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByTestId("line-meaning")).toBeNull();

    fireEvent.click(toggle("meaning")!);
    expect(screen.getByTestId("line-meaning").textContent).toBe("Siapa nama Anda?");

    fireEvent.click(toggle("romaji")!);
    expect(screen.queryByTestId("line-romaji")).toBeNull();
  });

  it("Tes: tidak ada tombol Romaji/Arti dan keduanya tidak pernah tampil", async () => {
    await start("test");

    expect(toggle("romaji")).toBeNull();
    expect(toggle("meaning")).toBeNull();
    expect(toggle("furigana")).not.toBeNull();
    expect(screen.queryByTestId("line-romaji")).toBeNull();
    expect(screen.queryByTestId("line-meaning")).toBeNull();
    expect(screen.getByText("Mode Tes: tanpa romaji dan arti.")).toBeTruthy();
  });

  it("furigana tampil di atas kanji secara bawaan dan bisa dimatikan", async () => {
    await start("practice");
    const jp = screen.getByTestId("line-jp");

    expect(readings(jp)).toEqual(["なまえ", "なん"]);
    expect(toggle("furigana")!.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggle("furigana")!);
    expect(jp.querySelectorAll("ruby")).toHaveLength(0);
    expect(jp.textContent).toBe("お名前は何ですか。");
  });

  it("pilihan jawaban juga berfurigana, dan data-text tetap teks Jepang aslinya", async () => {
    await start("practice");
    fireEvent.click(within(screen.getByTestId("narration-line")).getByTestId("next-button"));

    const options = await screen.findAllByTestId("choice-option");
    expect(options[0]!.getAttribute("data-text")).toBe("わたしの名前はアニです。");
    expect(readings(options[0]!)).toEqual(["なまえ"]);
    expect(options[1]!.querySelectorAll("ruby")).toHaveLength(0); // さようなら tanpa kanji
  });

  it("pilihan tombol berlaku untuk baris berikutnya dalam sesi yang sama", async () => {
    await start("practice");
    fireEvent.click(toggle("furigana")!);
    fireEvent.click(within(screen.getByTestId("narration-line")).getByTestId("next-button"));

    const options = await screen.findAllByTestId("choice-option");
    expect(options[0]!.querySelectorAll("ruby")).toHaveLength(0);
    expect(toggle("furigana")!.getAttribute("aria-pressed")).toBe("false");
  });
});
