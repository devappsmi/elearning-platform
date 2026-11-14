import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NETWORK_ERROR_TEXT } from "../auth/api-errors";
import { callsTo, mockApi, type MockHandler } from "../test/api-mock";
import { makeMe, renderAuthedPage } from "../test/render";
import { PLACEMENT_PATH } from "../lib/placement";
import { PlacementPage } from "./PlacementPage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

const HIRAGANA = { id: "unit_hiragana", title: "Hiragana", levelName: "Hiragana" };
const KERJA = { id: "unit_kerja_3", title: "Percakapan di Tempat Kerja", levelName: "N4" };
const AVAILABLE = { enabled: true, available: true, questionCount: 3, passPercent: 80, sections: [HIRAGANA], result: null };

const TEST = {
  testId: "4f6c7a0e-2b1d-4c3a-9e8f-1a2b3c4d5e6f",
  expiresAt: "2026-10-12T14:00:00.000Z",
  passPercent: 80,
  sections: [{ unitId: "unit_hiragana", title: "Hiragana", questionCount: 3 }],
  questions: [
    { id: "q1", sectionUnitId: "unit_hiragana", kind: "kana_to_romaji", prompt: "し", options: [{ text: "shi" }, { text: "tsu" }, { text: "su" }, { text: "chi" }] },
    { id: "q2", sectionUnitId: "unit_hiragana", kind: "romaji_to_kana", prompt: "ka", options: [{ text: "か" }, { text: "が" }, { text: "け" }, { text: "こ" }] },
    { id: "q3", sectionUnitId: "unit_hiragana", kind: "word_meaning", prompt: "ねこ", options: [{ text: "anjing" }, { text: "kucing" }, { text: "burung" }, { text: "ikan" }] },
  ],
};

const PASSED = {
  takenAt: "2026-10-12T12:00:00.000Z",
  correct: 3,
  total: 3,
  passPercent: 80,
  sections: [{ unitId: "unit_hiragana", title: "Hiragana", correct: 3, total: 3, passed: true }],
  startUnit: KERJA,
  skippedUnits: [HIRAGANA],
};

const FAILED = {
  ...PASSED,
  correct: 9,
  total: 15,
  sections: [{ unitId: "unit_hiragana", title: "Hiragana", correct: 9, total: 15, passed: false }],
  startUnit: HIRAGANA,
  skippedUnits: [],
};

interface Handlers {
  status?: MockHandler;
  create?: MockHandler;
  submit?: MockHandler;
}

function renderPlacement({ status = () => ({ data: AVAILABLE }), create = () => ({ data: TEST }), submit = () => ({ data: PASSED }) }: Handlers = {}) {
  mockApi({ GET: { "/placement": status }, POST: { "/placement/tests": create, "/placement/attempts": submit } });
  return renderAuthedPage(<PlacementPage />, makeMe(), { path: PLACEMENT_PATH, entry: PLACEMENT_PATH, destinations: ["/"] });
}

const nextButton = () => screen.getByTestId("placement-next") as HTMLButtonElement;
const counter = () => screen.getByTestId("placement-counter").textContent;
const option = (text: string) => screen.getAllByTestId("placement-option").find((el) => (el as HTMLInputElement).value === text)!;

async function startTest() {
  fireEvent.click(await screen.findByTestId("placement-start"));
  await screen.findByTestId("placement-question");
}

/** Jawab ketiga soal: q1 "shi", q2 "Belum tahu", q3 "kucing". */
async function answerAll() {
  fireEvent.click(option("shi"));
  fireEvent.click(nextButton());
  fireEvent.click(screen.getByTestId("placement-unknown"));
  fireEvent.click(nextButton());
  fireEvent.click(option("kucing"));
}

beforeEach(() => vi.clearAllMocks());

describe("PlacementPage -- pengantar", () => {
  it("menjelaskan jumlah soal, ambang lulus, dan bagian yang bisa dilewati", async () => {
    renderPlacement();

    const intro = await screen.findByTestId("placement-intro");
    expect(intro.textContent).toContain("Sudah bisa membaca Hiragana?");
    expect(intro.textContent).toContain("3 soal pilihan ganda");
    expect(intro.textContent).toContain("minimal 80% di bagian Hiragana");
    expect(intro.textContent).toContain("hanya bisa diambil sekali");
    expect(callsTo("POST", "/placement/tests")).toHaveLength(0);
  });

  it("'Lewati, mulai dari awal' kembali ke Beranda tanpa membuat tes", async () => {
    renderPlacement();

    fireEvent.click(await screen.findByTestId("placement-skip"));

    expect(screen.getByTestId("destination-path").textContent).toBe("/");
    expect(callsTo("POST", "/placement/tests")).toHaveLength(0);
  });
});

describe("PlacementPage -- mengerjakan soal", () => {
  it("soal pertama: nomor, perintah sesuai jenis soal, 'Lanjut' aktif setelah memilih", async () => {
    renderPlacement();
    await startTest();

    expect(counter()).toBe("Soal 1 dari 3");
    expect(screen.getByText("Bagaimana cara membaca huruf ini?")).toBeTruthy();
    expect(screen.getByTestId("exercise-prompt").textContent).toBe("し");
    expect(screen.getAllByTestId("placement-option")).toHaveLength(4);
    expect(nextButton().disabled).toBe(true);
    expect((screen.getByTestId("placement-prev") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(option("tsu"));
    expect(nextButton().disabled).toBe(false);
    expect(nextButton().textContent).toBe("Lanjut");
  });

  it("tidak ada tanda benar/salah selama tes", async () => {
    renderPlacement();
    await startTest();

    fireEvent.click(option("tsu"));
    fireEvent.click(nextButton());

    expect(counter()).toBe("Soal 2 dari 3");
    expect(screen.getByText("Pilih huruf untuk bunyi ini.")).toBeTruthy();
    expect(screen.queryByTestId("feedback")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Benar!|Jawaban yang benar/);
  });

  it("'Sebelumnya' menampilkan pilihan lama, yang bisa diganti sebelum dikirim", async () => {
    let sent: unknown;
    renderPlacement({
      submit: ({ body }) => {
        sent = body;
        return { data: PASSED };
      },
    });
    await startTest();
    fireEvent.click(option("tsu"));
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByTestId("placement-prev"));
    expect(counter()).toBe("Soal 1 dari 3");
    expect((option("tsu") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(option("shi"));
    fireEvent.click(nextButton());
    fireEvent.click(screen.getByTestId("placement-unknown"));
    fireEvent.click(nextButton());
    fireEvent.click(option("kucing"));
    fireEvent.click(nextButton());

    await screen.findByTestId("placement-result");
    expect(sent).toEqual({ testId: TEST.testId, answers: [{ choiceText: "shi" }, { choiceText: null }, { choiceText: "kucing" }] });
  });

  it("soal terakhir: tombol 'Kirim jawaban', satu kali kirim berisi semua jawaban urut soal ('Belum tahu' = null)", async () => {
    renderPlacement();
    await startTest();
    await answerAll();

    expect(screen.getByText("Apa arti kata ini?")).toBeTruthy();
    expect(nextButton().textContent).toBe("Kirim jawaban");
    fireEvent.click(nextButton());

    await screen.findByTestId("placement-result");
    const calls = callsTo("POST", "/placement/attempts");
    expect(calls).toHaveLength(1);
    expect((calls[0]![1] as { body: unknown }).body).toEqual({
      testId: TEST.testId,
      answers: [{ choiceText: "shi" }, { choiceText: null }, { choiceText: "kucing" }],
    });
  });
});

describe("PlacementPage -- hasil", () => {
  it("lulus: bagian yang dilewati, skor, unit awal; 'Mulai belajar' ke Beranda", async () => {
    renderPlacement();
    await startTest();
    await answerAll();
    fireEvent.click(nextButton());

    const result = await screen.findByTestId("placement-result");
    expect(result.getAttribute("data-passed")).toBe("true");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hebat! Hiragana dilewati");
    expect(screen.getByTestId("placement-score").textContent).toBe("3 dari 3 jawaban benar");
    expect(screen.getByTestId("placement-start-unit").textContent).toContain("Percakapan di Tempat Kerja");
    expect(screen.getByTestId("placement-start-unit").textContent).toContain("level N4");
    expect(result.textContent).toContain("Lulus");

    fireEvent.click(screen.getByRole("button", { name: /Mulai belajar/ }));
    expect(screen.getByTestId("destination-path").textContent).toBe("/");
  });

  it("tidak lulus: mulai dari awal dan disebut berapa jawaban benar yang diperlukan", async () => {
    renderPlacement({ submit: () => ({ data: FAILED }) });
    await startTest();
    await answerAll();
    fireEvent.click(nextButton());

    const result = await screen.findByTestId("placement-result");
    expect(result.getAttribute("data-passed")).toBe("false");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Kita mulai dari awal");
    expect(result.textContent).toContain("Hiragana: 9/15 benar");
    expect(result.textContent).toContain("Perlu 12");
    expect(screen.getByTestId("placement-start-unit").textContent).toContain("Hiragana");
  });
});

describe("PlacementPage -- status lain dan galat", () => {
  it("sudah pernah ikut: menampilkan hasil tersimpan, tanpa tombol mulai", async () => {
    renderPlacement({ status: () => ({ data: { ...AVAILABLE, available: false, sections: [], result: PASSED } }) });

    const taken = await screen.findByTestId("placement-taken");
    expect(taken.textContent).toContain("Hasil: 3 dari 3 jawaban benar. Hiragana dilewati.");
    expect(taken.textContent).toContain("Percakapan di Tempat Kerja");
    expect(taken.textContent).toContain("12 Oktober 2026");
    expect(screen.queryByTestId("placement-start")).toBeNull();
  });

  it("dimatikan atau tidak berhak: pesan yang sesuai", async () => {
    renderPlacement({ status: () => ({ data: { ...AVAILABLE, enabled: false, available: false, sections: [] } }) });
    expect((await screen.findByTestId("placement-unavailable")).textContent).toContain("sedang tidak tersedia");
  });

  it("sudah menyelesaikan pelajaran: pesan bahwa tes hanya sebelum pelajaran pertama", async () => {
    renderPlacement({ status: () => ({ data: { ...AVAILABLE, available: false, sections: [] } }) });
    expect((await screen.findByTestId("placement-unavailable")).textContent).toContain("belum menyelesaikan satu pelajaran pun");
  });

  it("tes kedaluwarsa (410): kembali ke pengantar dengan pesan server, bisa mulai lagi", async () => {
    const message = "Tes ini sudah kedaluwarsa atau sudah diganti tes yang lebih baru. Mulai tes lagi.";
    renderPlacement({ submit: () => ({ error: { message }, status: 410 }) });
    await startTest();
    await answerAll();
    fireEvent.click(nextButton());

    await screen.findByTestId("placement-intro");
    expect(screen.getByRole("alert").textContent).toBe(message);
    await startTest();
    expect(counter()).toBe("Soal 1 dari 3");
  });

  it("sudah tercatat dari tab lain (409): menampilkan hasil yang tersimpan", async () => {
    let taken = false;
    renderPlacement({
      status: () => ({ data: taken ? { ...AVAILABLE, available: false, sections: [], result: PASSED } : AVAILABLE }),
      submit: () => {
        taken = true;
        return { error: { message: "Tes penempatan hanya bisa diambil sekali." }, status: 409 };
      },
    });
    await startTest();
    await answerAll();
    fireEvent.click(nextButton());

    expect(await screen.findByTestId("placement-taken")).toBeTruthy();
  });

  it("gangguan jaringan saat mengirim: jawaban tetap ada, bisa dikirim ulang", async () => {
    let attempt = 0;
    renderPlacement({
      submit: () => {
        attempt++;
        if (attempt === 1) throw new Error("offline");
        return { data: PASSED };
      },
    });
    await startTest();
    await answerAll();
    fireEvent.click(nextButton());

    expect((await screen.findByRole("alert")).textContent).toBe(NETWORK_ERROR_TEXT);
    expect(counter()).toBe("Soal 3 dari 3");
    expect((option("kucing") as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(nextButton().disabled).toBe(false));
    fireEvent.click(nextButton());

    expect(await screen.findByTestId("placement-result")).toBeTruthy();
    expect(attempt).toBe(2);
  });

  it("tes tidak bisa dibuat (409 dari server): pesan server, lalu status dimuat ulang", async () => {
    let calls = 0;
    renderPlacement({
      status: () => {
        calls++;
        return { data: calls === 1 ? AVAILABLE : { ...AVAILABLE, available: false, sections: [] } };
      },
      create: () => ({ error: { message: "Tes penempatan hanya untuk murid yang belum menyelesaikan satu pelajaran pun." }, status: 409 }),
    });

    fireEvent.click(await screen.findByTestId("placement-start"));

    expect(await screen.findByTestId("placement-unavailable")).toBeTruthy();
    expect(calls).toBe(2);
  });

  it("status gagal dimuat: pesan dan tombol coba lagi", async () => {
    let calls = 0;
    renderPlacement({
      status: () => {
        calls++;
        return calls === 1 ? { error: { message: "x" }, status: 500 } : { data: AVAILABLE };
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Coba lagi" }));

    expect(await screen.findByTestId("placement-intro")).toBeTruthy();
  });
});
