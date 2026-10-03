import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { NETWORK_ERROR_TEXT } from "../auth/api-errors";
import { callsTo, mockApi } from "../test/api-mock";
import type { MockHandler, MockResult } from "../test/api-mock";
import { installFakeMedia } from "../test/fake-media";
import type { FakeMedia } from "../test/fake-media";
import { renderPage } from "../test/render";
import { TUTOR_HELP_REQUEST_TEXT, TUTOR_PATH } from "../lib/tutor-chat";
import { TutorPage } from "./TutorPage";

vi.mock("../auth/api-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}));

const CATALOG = {
  scenarios: [
    { id: "perkenalan", title: "Perkenalan Diri", description: "Berkenalan dengan teman sekelas baru." },
    { id: "restoran", title: "Di Restoran", description: "Memesan makanan dan minuman." },
    { id: "arah", title: "Menanyakan Arah", description: "Bertanya jalan." },
    { id: "belanja", title: "Belanja di Toko", description: "Mencari barang." },
  ],
  characters: [
    { id: "yuki", name: "Yuki", personality: "Ramah dan sabar." },
    { id: "kenji", name: "Kenji", personality: "Santai dan ceria." },
    { id: "sora", name: "Sora", personality: "Tenang dan sopan." },
  ],
};
const RESETS_AT = "2026-10-04T00:00:00.000Z";
const quotaOf = (used: number) => ({ limit: 20, used, remaining: 20 - used, resetsAt: RESETS_AT });
const AUDIO_URL = "http://localhost:3001/media/audio/abc.mp3";
const TRANSCRIPT = "はじめまして。わたしはアニです。";

/** Balasan AI berurutan dengan jatah yang ikut berkurang. */
function replies(texts: string[] = ["おなまえは？", "どこからきましたか？", "そうですか。"], usedBefore = 0) {
  let n = 0;
  return vi.fn<MockHandler>(() => {
    const text = texts[Math.min(n, texts.length - 1)]!;
    n += 1;
    return { data: { reply: text, quota: quotaOf(usedBefore + n) } };
  });
}

interface ApiOverrides {
  catalog?: MockHandler;
  quota?: MockHandler;
  reply?: MockHandler;
  speak?: MockHandler;
  transcribe?: MockHandler;
}

function installApi(overrides: ApiOverrides = {}) {
  // Setiap endpoint dibungkus mata-mata, jadi tes bisa memeriksa isi permintaan tanpa peduli penanganan mana yang dipakai.
  const defaultReply = replies();
  const reply = vi.fn<MockHandler>((input) => (overrides.reply ?? defaultReply)(input));
  const speak = vi.fn<MockHandler>((input) => (overrides.speak ?? (() => ({ data: { audioUrl: AUDIO_URL } })))(input));
  const transcribe = vi.fn<MockHandler>((input) => (overrides.transcribe ?? (() => ({ data: { text: TRANSCRIPT } })))(input));
  mockApi({
    GET: {
      "/tutor/scenarios": overrides.catalog ?? (() => ({ data: CATALOG })),
      "/tutor/quota": overrides.quota ?? (() => ({ data: quotaOf(0) })),
    },
    POST: { "/tutor/reply": reply, "/tutor/speak": speak, "/tutor/transcribe": transcribe },
  });
  return { reply, speak, transcribe };
}

function renderTutor() {
  return renderPage(<TutorPage />, { path: TUTOR_PATH, entry: TUTOR_PATH, destinations: ["/conversation"] });
}

// ---- pembantu pencarian elemen ----------------------------------------------------------------------------------------
const input = () => screen.getByTestId("chat-input") as HTMLInputElement;
const sendButton = () => screen.getByTestId("send-button") as HTMLButtonElement;
const micButton = () => screen.getByTestId("mic-button") as HTMLButtonElement;
const helpButton = () => screen.getByTestId("help-button") as HTMLButtonElement;
const aiMessages = () => screen.queryAllByTestId("ai-message");
const userMessages = () => screen.queryAllByTestId("user-message");

async function openChat() {
  renderTutor();
  fireEvent.click(await screen.findByTestId("start-chat"));
  await screen.findByTestId("empty-chat");
}

async function say(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  fireEvent.click(sendButton());
}

function bodyOf(handler: Mock<MockHandler>, call = 0) {
  return handler.mock.calls[call]![0].body as Record<string, unknown>;
}

/** `src` elemen audio pada saat setiap play() dipanggil (elemennya satu dan dipakai ulang, jadi `src` harus dicatat saat itu juga). */
const playLog: string[] = [];

/** Alamat berkas yang diputar, tanpa WAV senyap yang hanya membuka kunci pemutaran. */
function playedUrls(): string[] {
  return playLog.filter((src) => !src.startsWith("data:"));
}

let media: FakeMedia | null = null;
let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  media = installFakeMedia();
  playLog.length = 0;
  play = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    playLog.push(this.src);
    return Promise.resolve();
  });
  pause = vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup(); // lepas komponen (mikrofon, audio) sebelum spy dan perangkat tiruan dikembalikan
  vi.useRealTimers();
  vi.restoreAllMocks();
  media?.uninstall();
  media = null;
});

describe("TutorPage: layar pilih", () => {
  it("memuat katalog dan jatah, menampilkan situasi, teman bicara, dan sisa jatah", async () => {
    installApi();
    renderTutor();

    expect(await screen.findByRole("radio", { name: /Perkenalan Diri/ })).toBeTruthy();
    expect(screen.getAllByRole("radio", { name: /Perkenalan Diri|Di Restoran|Menanyakan Arah|Belanja di Toko/ })).toHaveLength(4);
    expect(screen.getAllByRole("radio", { name: /Yuki|Kenji|Sora/ })).toHaveLength(3);
    expect(screen.getByTestId("quota-chip").textContent).toBe("Sisa jatah hari ini: 20 dari 20 balasan");
    expect(callsTo("GET", "/tutor/scenarios")).toHaveLength(1);
    expect(callsTo("GET", "/tutor/quota")).toHaveLength(1);
  });

  it("pilihan pertama terpilih lebih dulu (situasi dan karakter)", async () => {
    installApi();
    renderTutor();

    expect((await screen.findByRole("radio", { name: /Perkenalan Diri/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /Yuki/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("gagal memuat: pesan galat dan tombol 'Coba Lagi' yang memuat ulang sampai berhasil", async () => {
    let attempt = 0;
    installApi({
      catalog: () => {
        attempt += 1;
        return attempt === 1 ? { error: { statusCode: 500 }, status: 500 } : { data: CATALOG };
      },
    });
    renderTutor();

    expect((await screen.findByRole("alert")).textContent).toBe("Gagal memuat halaman ini.");
    fireEvent.click(screen.getByRole("button", { name: "Coba Lagi" }));

    expect(await screen.findByTestId("start-chat")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("gangguan jaringan saat memuat: pesan galat (tidak macet di 'Memuat...')", async () => {
    installApi({
      quota: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    renderTutor();

    expect((await screen.findByRole("alert")).textContent).toBe("Gagal memuat halaman ini.");
    expect(screen.queryByText("Memuat...")).toBeNull();
  });

  it("jatah hari ini sudah habis: tombol mulai mati", async () => {
    installApi({ quota: () => ({ data: quotaOf(20) }) });
    renderTutor();

    const start = (await screen.findByTestId("start-chat")) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByText("Jatah ngobrol hari ini sudah habis. Jatahmu kembali besok.")).toBeTruthy();
  });

  it("browser tanpa rekam suara: ada catatan di layar pilih", async () => {
    media!.uninstall();
    media = null;
    installApi();
    renderTutor();

    expect(await screen.findByText("Browser ini belum mendukung rekam suara. Kamu bisa mengetik jawabanmu.")).toBeTruthy();
  });

  it("alamat bukan HTTPS: catatan menjelaskan penyebabnya", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    installApi();
    renderTutor();

    expect(await screen.findByText("Rekam suara hanya berfungsi lewat alamat HTTPS. Kamu bisa mengetik jawabanmu.")).toBeTruthy();
  });

  it("tautan kembali membawa ke daftar Percakapan", async () => {
    installApi();
    renderTutor();

    fireEvent.click(await screen.findByRole("link", { name: /Kembali ke Percakapan/ }));

    expect(screen.getByTestId("destination-path").textContent).toBe("/conversation");
  });
});

describe("TutorPage: ngobrol dengan mengetik", () => {
  it("mulai: judul situasi, nama karakter, sisa jatah, dan ajakan dengan contoh pembuka", async () => {
    installApi();
    await openChat();

    expect(screen.getByRole("heading", { name: "Perkenalan Diri" })).toBeTruthy();
    expect(screen.getByText("Bersama Yuki")).toBeTruthy();
    expect(screen.getByTestId("quota-chip").textContent).toBe("Sisa 20");
    expect(screen.getByText("Mulai dengan menyapa Yuki")).toBeTruthy();
    expect(screen.getByText("はじめまして。")).toBeTruthy();
  });

  it("'Pakai contoh ini' mengisi kolom ketik dengan pembuka situasi yang dipilih", async () => {
    installApi();
    renderTutor();
    fireEvent.click(await screen.findByRole("radio", { name: /Menanyakan Arah/ }));
    fireEvent.click(screen.getByTestId("start-chat"));
    await screen.findByTestId("empty-chat");

    fireEvent.click(screen.getByTestId("use-opener"));

    expect(input().value).toBe("すみません、えきはどこですか。");
  });

  it("kirim: situasi + karakter pilihan dan riwayat dikirim; balasan tampil, jatah diperbarui, kolom dikosongkan", async () => {
    const api = installApi();
    renderTutor();
    fireEvent.click(await screen.findByRole("radio", { name: /Di Restoran/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Kenji/ }));
    fireEvent.click(screen.getByTestId("start-chat"));
    await screen.findByTestId("empty-chat");

    await say("すみません。");
    await screen.findByText("おなまえは？");

    expect(bodyOf(api.reply)).toEqual({
      scenarioId: "restoran",
      characterId: "kenji",
      history: [{ role: "user", text: "すみません。" }],
    });
    expect(userMessages().map((m) => m.textContent)).toEqual(["すみません。"]);
    expect(aiMessages()).toHaveLength(1);
    expect(screen.getByTestId("quota-chip").textContent).toBe("Sisa 19");
    expect(input().value).toBe("");
    expect(screen.queryByTestId("empty-chat")).toBeNull();
  });

  it("giliran berikutnya mengirim SELURUH riwayat berurutan (murid, AI, murid)", async () => {
    const api = installApi();
    await openChat();

    await say("はじめまして。");
    await screen.findByText("おなまえは？");
    await say("アニです。");
    await screen.findByText("どこからきましたか？");

    expect(bodyOf(api.reply, 1).history).toEqual([
      { role: "user", text: "はじめまして。" },
      { role: "assistant", text: "おなまえは？" },
      { role: "user", text: "アニです。" },
    ]);
    expect(userMessages()).toHaveLength(2);
    expect(aiMessages()).toHaveLength(2);
  });

  it("teks dipangkas spasinya sebelum dikirim, dan Enter di kolom (kirim lewat formulir) bekerja", async () => {
    const api = installApi();
    await openChat();

    fireEvent.change(input(), { target: { value: "  こんにちは。  " } });
    fireEvent.submit(input().closest("form")!);
    await screen.findByText("おなまえは？");

    expect(bodyOf(api.reply).history).toEqual([{ role: "user", text: "こんにちは。" }]);
  });

  it("hanya spasi: tombol kirim mati dan tidak ada permintaan", async () => {
    const api = installApi();
    await openChat();

    fireEvent.change(input(), { target: { value: "    " } });
    fireEvent.submit(input().closest("form")!);

    expect(sendButton().disabled).toBe(true);
    expect(api.reply).not.toHaveBeenCalled();
  });

  it("selagi menunggu balasan: indikator mengetik tampil dan kirim lagi tidak mungkin; sesudahnya hilang", async () => {
    let release!: (result: MockResult) => void;
    const api = installApi({ reply: vi.fn<MockHandler>(() => new Promise<MockResult>((resolve) => (release = resolve))) });
    await openChat();

    await say("こんにちは。");
    expect(await screen.findByTestId("typing")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Yuki sedang menjawab...");
    expect(input().disabled).toBe(true);
    expect(micButton().disabled).toBe(true);
    expect(api.reply).toHaveBeenCalledOnce();

    release({ data: { reply: "こんにちは！", quota: quotaOf(1) } });

    await screen.findByText("こんにちは！");
    expect(screen.queryByTestId("typing")).toBeNull();
    expect(input().disabled).toBe(false);
  });

  it("balasan dibacakan: teks balasan + karakter dikirim ke /tutor/speak, suara diputar otomatis dengan alamat dari server", async () => {
    const api = installApi();
    await openChat();

    await say("こんにちは。");
    await screen.findByTestId("play-reply");

    expect(bodyOf(api.speak)).toEqual({ text: "おなまえは？", characterId: "yuki" });
    await waitFor(() => expect(playedUrls()).toEqual([AUDIO_URL]));
  });

  it("tombol 'Dengarkan' memutar ulang; ditekan saat sedang diputar menghentikannya", async () => {
    installApi();
    await openChat();
    await say("こんにちは。");
    const button = await screen.findByTestId("play-reply");
    await waitFor(() => expect(playedUrls()).toEqual([AUDIO_URL])); // putar otomatis
    expect(button.getAttribute("aria-label")).toBe("Suara sedang diputar");
    expect(button.textContent).toContain("Memutar...");

    pause.mockClear();
    fireEvent.click(button); // ditekan saat diputar -> berhenti
    expect(pause).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("play-reply").getAttribute("aria-label")).toBe("Dengarkan balasan"));

    fireEvent.click(screen.getByTestId("play-reply")); // diputar ulang
    await waitFor(() => expect(playedUrls()).toEqual([AUDIO_URL, AUDIO_URL]));
    expect(screen.getByTestId("play-reply").getAttribute("aria-label")).toBe("Suara sedang diputar");
  });

  it("selesai diputar: tombol kembali ke 'Dengarkan'", async () => {
    installApi();
    await openChat();
    await say("こんにちは。");
    await screen.findByTestId("play-reply");
    await waitFor(() => expect(playedUrls()).toHaveLength(1));

    act(() => {
      (play.mock.contexts.at(-1) as HTMLAudioElement).dispatchEvent(new Event("ended"));
    });

    expect(screen.getByTestId("play-reply").getAttribute("aria-label")).toBe("Dengarkan balasan");
  });

  it("suara dimatikan lewat tombol di atas: balasan tidak diputar otomatis, tetapi tombol Dengarkan tetap ada", async () => {
    installApi();
    await openChat();
    fireEvent.click(screen.getByTestId("sound-toggle"));
    expect(screen.getByTestId("sound-toggle").getAttribute("aria-pressed")).toBe("false");

    await say("こんにちは。");
    await screen.findByRole("button", { name: "Dengarkan balasan" });

    expect(playedUrls()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Dengarkan balasan" }));
    await waitFor(() => expect(playedUrls()).toEqual([AUDIO_URL]));
  });

  it("mematikan suara saat sedang diputar langsung menjedanya", async () => {
    installApi();
    await openChat();
    await say("こんにちは。");
    await waitFor(() => expect(playedUrls()).toHaveLength(1));
    pause.mockClear();

    fireEvent.click(screen.getByTestId("sound-toggle"));

    expect(pause).toHaveBeenCalled();
  });

  it("browser menolak putar otomatis: ada petunjuk sekali saja, dan tombol Dengarkan tetap bisa dipakai", async () => {
    installApi();
    await openChat();
    play.mockRejectedValue(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));

    await say("こんにちは。");
    expect(await screen.findByText("Browser menahan suara otomatis. Tekan Dengarkan di balasan untuk mendengarnya.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dengarkan balasan" })).toBeTruthy();
  });

  it("suara gagal dibuat (502): keterangan di gelembung, percakapan tetap berjalan", async () => {
    installApi({ speak: () => ({ error: { statusCode: 502 }, status: 502 }) });
    await openChat();

    await say("こんにちは。");

    expect(await screen.findByText("Suara belum tersedia untuk balasan ini.")).toBeTruthy();
    expect(screen.getByText("おなまえは？")).toBeTruthy();
    expect(playedUrls()).toEqual([]);
    await say("アニです。");
    await screen.findByText("どこからきましたか？");
  });

  it("suara belum diaktifkan di server (503): tidak meminta suara lagi untuk balasan berikutnya", async () => {
    const api = installApi({ speak: vi.fn<MockHandler>(() => ({ error: { statusCode: 503 }, status: 503 })) });
    await openChat();

    await say("こんにちは。");
    await screen.findByText("おなまえは？");
    await waitFor(() => expect(screen.getAllByText("Suara belum tersedia untuk balasan ini.")).toHaveLength(1));
    await say("アニです。");
    await screen.findByText("どこからきましたか？");

    expect(api.speak).toHaveBeenCalledOnce();
    expect(screen.getAllByText("Suara belum tersedia untuk balasan ini.")).toHaveLength(2);
  });

  it("gagal kirim (502): pesan ditarik dari percakapan, kolom terisi lagi, jatah tidak berubah; kirim ulang berhasil tanpa menggandakan", async () => {
    let attempt = 0;
    const api = installApi({
      reply: vi.fn<MockHandler>(() => {
        attempt += 1;
        return attempt === 1 ? { error: { statusCode: 502 }, status: 502 } : { data: { reply: "おなまえは？", quota: quotaOf(1) } };
      }),
    });
    await openChat();

    await say("はじめまして。");
    expect((await screen.findByRole("alert")).textContent).toBe("Layanan AI sedang bermasalah. Coba lagi sebentar lagi. Jatahmu tidak terpotong.");
    expect(userMessages()).toHaveLength(0);
    expect(input().value).toBe("はじめまして。");
    expect(screen.getByTestId("quota-chip").textContent).toBe("Sisa 20");
    expect(input().disabled).toBe(false);

    fireEvent.click(sendButton());
    await screen.findByText("おなまえは？");

    expect(userMessages()).toHaveLength(1);
    expect(bodyOf(api.reply, 1).history).toEqual([{ role: "user", text: "はじめまして。" }]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("jaringan putus saat kirim: pesan jaringan dan teks dikembalikan ke kolom", async () => {
    installApi({
      reply: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await openChat();

    await say("はじめまして。");

    expect((await screen.findByRole("alert")).textContent).toBe(NETWORK_ERROR_TEXT);
    expect(input().value).toBe("はじめまして。");
    expect(userMessages()).toHaveLength(0);
    expect(screen.queryByTestId("typing")).toBeNull();
  });

  it("jatah habis di tengah jalan (429 dengan quota): pesan, kolom dimatikan, sisa jatah 0, teks tidak hilang", async () => {
    installApi({
      reply: () => ({
        error: { statusCode: 429, message: "Kuota harian AI tutor habis.", quota: quotaOf(20) },
        status: 429,
      }),
    });
    await openChat();

    await say("はじめまして。");

    expect((await screen.findByRole("alert")).textContent).toBe("Jatah ngobrol hari ini sudah habis. Jatahmu kembali besok.");
    expect(input().disabled).toBe(true);
    expect(micButton().disabled).toBe(true);
    expect(helpButton().disabled).toBe(true);
    expect(screen.getByTestId("quota-chip").textContent).toBe("Sisa 0");
    expect(input().value).toBe("はじめまして。");
  });

  it("balasan terakhir menghabiskan jatah: balasan tampil, lalu kolom dimatikan dengan penjelasan", async () => {
    installApi({ reply: () => ({ data: { reply: "またね！", quota: quotaOf(20) } }) });
    await openChat();

    await say("さようなら。");

    expect(await screen.findByText("またね！")).toBeTruthy();
    expect((await screen.findByRole("alert")).textContent).toBe("Jatah ngobrol hari ini sudah habis. Jatahmu kembali besok.");
    expect(input().disabled).toBe(true);
  });

  it("terlalu sering memanggil (429 biasa): pesan sabar, kolom tetap aktif untuk mencoba lagi", async () => {
    installApi({ reply: () => ({ error: { statusCode: 429, message: "ThrottlerException: Too Many Requests" }, status: 429 }) });
    await openChat();

    await say("はじめまして。");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Terlalu banyak permintaan dalam waktu singkat. Tunggu sebentar lalu coba lagi.");
    expect(document.body.textContent).not.toContain("Throttler");
    expect(input().disabled).toBe(false);
  });

  it("AI belum diaktifkan di server (503): pesan jelas dan kolom dimatikan", async () => {
    installApi({ reply: () => ({ error: { statusCode: 503, message: "AI tutor belum dikonfigurasi di server ini." }, status: 503 }) });
    await openChat();

    await say("はじめまして。");

    expect((await screen.findByRole("alert")).textContent).toBe("Fitur ngobrol dengan AI belum diaktifkan di server ini. Hubungi admin lembaga.");
    expect(input().disabled).toBe(true);
    expect(userMessages()).toHaveLength(0);
  });

  it("riwayat lebih dari 40 giliran dipangkas ke 40 terakhir saat dikirim", async () => {
    const api = installApi({ reply: vi.fn<MockHandler>(() => ({ data: { reply: "balasan", quota: quotaOf(1) } })) });
    await openChat();

    for (let i = 1; i <= 22; i += 1) {
      await say(`pesan-${i}`);
      await waitFor(() => expect(api.reply).toHaveBeenCalledTimes(i));
      await waitFor(() => expect(aiMessages()).toHaveLength(i));
    }

    const history = bodyOf(api.reply, 21).history as { role: string; text: string }[];
    expect(history).toHaveLength(40);
    expect(history.at(-1)).toEqual({ role: "user", text: "pesan-22" });
    expect(history[0]!.role).toBe("assistant"); // 43 giliran: 3 terbuang dari awal
  });
});

describe("TutorPage: minta contoh jawaban", () => {
  it("memakai mode bantuan, riwayat ditutup kalimat penanda; kartu tampil dan jatah berkurang", async () => {
    const api = installApi({
      reply: vi.fn<MockHandler>(() => ({ data: { reply: "Contoh jawaban:\n1. はじめまして。(Senang berkenalan.)", quota: quotaOf(1) } })),
    });
    await openChat();

    fireEvent.click(helpButton());
    expect(await screen.findByTestId("tip-message")).toBeTruthy();

    expect(bodyOf(api.reply)).toEqual({
      scenarioId: "perkenalan",
      characterId: "yuki",
      mode: "help",
      history: [{ role: "user", text: TUTOR_HELP_REQUEST_TEXT }],
    });
    expect(screen.getByTestId("tip-message").textContent).toContain("1. はじめまして。(Senang berkenalan.)");
    expect(screen.getByTestId("quota-chip").textContent).toBe("Sisa 19");
    expect(screen.queryByTestId("empty-chat")).toBeNull(); // sudah ada isi di layar, ajakan awal tidak perlu lagi
  });

  it("kartu bantuan tidak ikut riwayat percakapan berikutnya, tidak dibacakan, dan tidak mengubah giliran", async () => {
    const api = installApi({
      reply: vi.fn<MockHandler>(({ body }) => {
        const mode = (body as { mode?: string }).mode;
        return { data: { reply: mode === "help" ? "Contoh jawaban: ..." : "おなまえは？", quota: quotaOf(1) } };
      }),
    });
    await openChat();
    await say("はじめまして。");
    await screen.findByText("おなまえは？");

    fireEvent.click(helpButton());
    await screen.findByTestId("tip-message");
    await say("アニです。");
    await waitFor(() => expect(api.reply).toHaveBeenCalledTimes(3));

    expect(bodyOf(api.reply, 1).history).toEqual([
      { role: "user", text: "はじめまして。" },
      { role: "assistant", text: "おなまえは？" },
      { role: "user", text: TUTOR_HELP_REQUEST_TEXT },
    ]);
    expect(bodyOf(api.reply, 2).history).toEqual([
      { role: "user", text: "はじめまして。" },
      { role: "assistant", text: "おなまえは？" },
      { role: "user", text: "アニです。" },
    ]);
    expect(api.speak).toHaveBeenCalledTimes(2); // dua balasan roleplay, bukan kartu bantuan
  });

  it("bantuan gagal: pesan galat, tanpa kartu", async () => {
    installApi({ reply: () => ({ error: { statusCode: 502 }, status: 502 }) });
    await openChat();

    fireEvent.click(helpButton());

    expect((await screen.findByRole("alert")).textContent).toContain("Layanan AI sedang bermasalah");
    expect(screen.queryByTestId("tip-message")).toBeNull();
  });
});

describe("TutorPage: berpindah dan mengakhiri", () => {
  it("tombol tutup kembali ke layar pilih; mulai lagi dari percakapan kosong (riwayat tidak terbawa)", async () => {
    const api = installApi();
    await openChat();
    await say("はじめまして。");
    await screen.findByText("おなまえは？");

    fireEvent.click(screen.getByTestId("end-chat"));
    expect(await screen.findByTestId("start-chat")).toBeTruthy();
    expect(screen.getByTestId("quota-chip").textContent).toBe("Sisa jatah hari ini: 19 dari 20 balasan");
    fireEvent.click(screen.getByTestId("start-chat"));

    expect(await screen.findByTestId("empty-chat")).toBeTruthy();
    expect(aiMessages()).toHaveLength(0);
    await say("こんにちは。");
    await waitFor(() => expect(api.reply).toHaveBeenCalledTimes(2));
    expect(bodyOf(api.reply, 1).history).toEqual([{ role: "user", text: "こんにちは。" }]);
  });

  it("balasan yang terlambat dari sesi yang sudah ditutup dibuang (tidak muncul di sesi baru, tidak dibacakan)", async () => {
    let release!: (result: MockResult) => void;
    const api = installApi({ reply: () => new Promise<MockResult>((resolve) => (release = resolve)) });
    await openChat();
    await say("はじめまして。");
    await screen.findByTestId("typing");

    fireEvent.click(screen.getByTestId("end-chat"));
    fireEvent.click(await screen.findByTestId("start-chat"));
    await screen.findByTestId("empty-chat");
    release({ data: { reply: "ふるい返事", quota: quotaOf(1) } });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.queryByText("ふるい返事")).toBeNull();
    expect(aiMessages()).toHaveLength(0);
    expect(screen.queryByTestId("typing")).toBeNull();
    expect(api.speak).not.toHaveBeenCalled();
  });

  it("halaman ditinggalkan saat menunggu balasan: tidak ada galat dan tidak ada permintaan suara", async () => {
    let release!: (result: MockResult) => void;
    const api = installApi({ reply: () => new Promise<MockResult>((resolve) => (release = resolve)) });
    const view = renderTutor();
    fireEvent.click(await screen.findByTestId("start-chat"));
    await screen.findByTestId("empty-chat");
    await say("はじめまして。");
    await screen.findByTestId("typing");

    view.unmount();
    release({ data: { reply: "こんにちは", quota: quotaOf(1) } });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(api.speak).not.toHaveBeenCalled();
  });
});

describe("TutorPage: bicara lewat mikrofon", () => {
  beforeEach(() => {
    // Hanya jam yang dipalsukan (rekaman minimal 0,4 detik); timer dan promise tetap nyata agar waitFor/findBy bekerja.
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);

  async function record(durationMs = 1500) {
    fireEvent.click(micButton());
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Merekam"));
    advance(durationMs);
    fireEvent.click(micButton());
  }

  it("merekam: tombol jadi 'berhenti', ada keterangan waktu, kolom ketik/kirim/bantuan mati", async () => {
    installApi();
    await openChat();

    fireEvent.click(micButton());
    await waitFor(() => expect(micButton().getAttribute("aria-pressed")).toBe("true"));

    expect(micButton().getAttribute("aria-label")).toBe("Berhenti merekam");
    expect(screen.getByRole("status").textContent).toMatch(/^Merekam 0:0\d dari 0:30\./);
    expect(input().disabled).toBe(true);
    expect(helpButton().disabled).toBe(true);
    expect(media!.getUserMedia).toHaveBeenCalledOnce();
  });

  it("rekam lalu berhenti: berkas dikirim ke /tutor/transcribe (multipart, bertipe audio), hasilnya masuk kolom ketik", async () => {
    const api = installApi();
    await openChat();

    await record();
    await waitFor(() => expect(input().value).toBe(TRANSCRIPT));

    expect(api.transcribe).toHaveBeenCalledOnce();
    const init = callsTo("POST", "/tutor/transcribe")[0]![1] as { bodySerializer: () => FormData };
    const form = init.bodySerializer();
    const file = form.get("file") as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("rekaman.webm");
    expect(file.type).toBe("audio/webm;codecs=opus");
    expect(file.size).toBe(4000);
    expect(screen.getByRole("status").textContent).toBe("Begini yang terdengar. Perbaiki kalau ada yang salah, lalu kirim.");
    expect(media!.tracks[0]!.stop).toHaveBeenCalled(); // mikrofon dilepas begitu selesai
    expect(userMessages()).toHaveLength(0); // belum dikirim: murid memeriksa dulu
  });

  it("kirim hasil rekaman: gelembung murid bertanda 'dari suara' dan teks yang tampil di kolom yang dikirim", async () => {
    const api = installApi();
    await openChat();
    await record();
    await waitFor(() => expect(input().value).toBe(TRANSCRIPT));

    fireEvent.click(sendButton());
    await screen.findByText("おなまえは？");

    expect(bodyOf(api.reply).history).toEqual([{ role: "user", text: TRANSCRIPT }]);
    expect(userMessages()[0]!.textContent).toContain("dari suara");
  });

  it("hasil rekaman boleh diperbaiki dulu: yang terkirim teks hasil perbaikan, tetap bertanda 'dari suara'", async () => {
    const api = installApi();
    await openChat();
    await record();
    await waitFor(() => expect(input().value).toBe(TRANSCRIPT));

    fireEvent.change(input(), { target: { value: "はじめまして。わたしはアニです。よろしく。" } });
    fireEvent.click(sendButton());
    await screen.findByText("おなまえは？");

    expect(bodyOf(api.reply).history).toEqual([{ role: "user", text: "はじめまして。わたしはアニです。よろしく。" }]);
    expect(userMessages()[0]!.textContent).toContain("dari suara");
  });

  it("mengosongkan kolom lalu mengetik pesan baru menghapus tanda 'dari suara'", async () => {
    installApi();
    await openChat();
    await record();
    await waitFor(() => expect(input().value).toBe(TRANSCRIPT));

    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.change(input(), { target: { value: "ぜんぶ自分で書きました" } });
    fireEvent.click(sendButton());
    await screen.findByText("おなまえは？");

    expect(userMessages()[0]!.textContent).not.toContain("dari suara");
  });

  it("hasil kosong (suara tidak terdengar jelas): peringatan, kolom tetap kosong", async () => {
    installApi({ transcribe: () => ({ data: { text: "  " } }) });
    await openChat();

    await record();

    expect((await screen.findByRole("alert")).textContent).toContain("Suaramu tidak terdengar jelas");
    expect(input().value).toBe("");
  });

  it("transkripsi gagal (502): pesan, dan murid bisa merekam lagi atau mengetik", async () => {
    let attempt = 0;
    installApi({
      transcribe: () => {
        attempt += 1;
        return attempt === 1 ? { error: { statusCode: 502 }, status: 502 } : { data: { text: TRANSCRIPT } };
      },
    });
    await openChat();

    await record();
    expect((await screen.findByRole("alert")).textContent).toBe("Suaramu belum bisa dikenali. Coba rekam lagi, atau ketik jawabanmu.");
    expect(micButton().disabled).toBe(false);
    expect(input().disabled).toBe(false);

    await record();
    await waitFor(() => expect(input().value).toBe(TRANSCRIPT));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("jaringan putus saat mengirim rekaman: pesan jaringan, tidak macet di 'Mengenali suaramu...'", async () => {
    installApi({
      transcribe: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await openChat();

    await record();

    expect((await screen.findByRole("alert")).textContent).toBe(NETWORK_ERROR_TEXT);
    expect(input().disabled).toBe(false);
  });

  it("fitur suara belum diaktifkan di server (503): mikrofon dimatikan untuk seterusnya, mengetik tetap jalan", async () => {
    installApi({ transcribe: () => ({ error: { statusCode: 503 }, status: 503 }) });
    await openChat();

    await record();

    expect((await screen.findAllByText("Fitur suara belum diaktifkan di server ini. Kamu tetap bisa mengetik jawabanmu.")).length).toBeGreaterThan(0);
    await waitFor(() => expect(micButton().disabled).toBe(true));
    await say("ketik saja");
    await screen.findByText("おなまえは？");
  });

  it("rekaman terlalu singkat: pesan, dan tidak ada permintaan transkripsi berbayar", async () => {
    const api = installApi();
    await openChat();

    await record(100);

    expect((await screen.findByRole("alert")).textContent).toBe("Rekamannya terlalu singkat. Coba lagi dan bicara sedikit lebih lama.");
    expect(api.transcribe).not.toHaveBeenCalled();
  });

  it("izin mikrofon ditolak: pesan dengan petunjuk pengaturan browser; setelah diizinkan bisa mencoba lagi", async () => {
    installApi();
    await openChat();
    media!.failWith("NotAllowedError");

    fireEvent.click(micButton());

    expect((await screen.findByRole("alert")).textContent).toContain("Izin mikrofon ditolak");
    expect(micButton().disabled).toBe(false);
    expect(input().disabled).toBe(false);

    media!.failWith(null);
    await record();
    await waitFor(() => expect(input().value).toBe(TRANSCRIPT));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("tidak ada mikrofon di perangkat: pesan yang menawarkan mengetik", async () => {
    installApi();
    await openChat();
    media!.failWith("NotFoundError");

    fireEvent.click(micButton());

    expect((await screen.findByRole("alert")).textContent).toBe("Mikrofon tidak ditemukan di perangkat ini. Kamu bisa mengetik jawabanmu.");
  });

  it("mulai merekam menghentikan suara balasan yang sedang diputar (tidak masuk ke mikrofon)", async () => {
    installApi();
    await openChat();
    await say("こんにちは。");
    await waitFor(() => expect(playedUrls()).toHaveLength(1));
    pause.mockClear();

    fireEvent.click(micButton());

    expect(pause).toHaveBeenCalled();
  });

  it("menutup obrolan saat merekam: mikrofon dilepas dan tidak ada permintaan transkripsi", async () => {
    const api = installApi();
    await openChat();
    fireEvent.click(micButton());
    await waitFor(() => expect(micButton().getAttribute("aria-pressed")).toBe("true"));
    advance(2000);

    fireEvent.click(screen.getByTestId("end-chat"));

    await screen.findByTestId("start-chat");
    expect(media!.tracks[0]!.stop).toHaveBeenCalled();
    expect(api.transcribe).not.toHaveBeenCalled();
  });

  it("rekaman pertama terkirim sambil menunggu: tombol kirim/mic mati selama 'Mengenali suaramu...'", async () => {
    let release!: (result: MockResult) => void;
    installApi({ transcribe: () => new Promise<MockResult>((resolve) => (release = resolve)) });
    await openChat();

    await record();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Mengenali suaramu..."));
    expect(micButton().disabled).toBe(true);
    expect(input().disabled).toBe(true);

    release({ data: { text: TRANSCRIPT } });
    await waitFor(() => expect(input().value).toBe(TRANSCRIPT));
  });
});
