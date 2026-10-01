import { describe, expect, it, vi } from "vitest";
import { lessonAudioItems, lessonAudioItemsForUnits, seedLessonAudio, type LessonAudioItem } from "./lesson-audio-seed";

describe("lessonAudioItemsForUnits", () => {
  it("menggabungkan beberapa unit berurutan; teks + suara yang sama di unit lain hanya sekali, suara lain tetap terpisah", () => {
    const items = lessonAudioItemsForUnits([
      { vocab: [{ surface: "あ" }, { surface: "犬" }], sentences: [{ surface: "犬が走る", voice: "male" }] },
      { vocab: [{ surface: "犬" }, { surface: "猫" }], sentences: [{ surface: "犬が走る", voice: "male" }, { surface: "犬が走る" }] },
    ]);
    expect(items).toEqual([
      { text: "あ", voice: "female" },
      { text: "犬", voice: "female" },
      { text: "犬が走る", voice: "male" },
      { text: "猫", voice: "female" },
      { text: "犬が走る", voice: "female" },
    ]);
  });

  it("tanpa unit: kosong", () => {
    expect(lessonAudioItemsForUnits([])).toEqual([]);
  });
});

describe("lessonAudioItems", () => {
  it("kosakata dulu (suara perempuan), lalu kalimat menurut suara masing-masing", () => {
    const items = lessonAudioItems({
      vocab: [{ surface: "あ" }, { surface: "い" }],
      sentences: [
        { surface: "愛", voice: "female" },
        { surface: "家", voice: "male" },
      ],
    });

    expect(items).toEqual([
      { text: "あ", voice: "female" },
      { text: "い", voice: "female" },
      { text: "愛", voice: "female" },
      { text: "家", voice: "male" },
    ]);
  });

  it("kalimat tanpa suara (atau bukan 'male') dianggap perempuan", () => {
    const items = lessonAudioItems({ vocab: [], sentences: [{ surface: "犬" }, { surface: "猫", voice: "lainnya" }] });

    expect(items.map((i) => i.voice)).toEqual(["female", "female"]);
  });

  it("pasangan (teks, suara) yang sama hanya sekali -- tiap duplikat berarti satu panggilan TTS berbayar di mode refresh", () => {
    const items = lessonAudioItems({
      vocab: [{ surface: "あ" }, { surface: "あ" }],
      sentences: [{ surface: "あ", voice: "female" }],
    });

    expect(items).toEqual([{ text: "あ", voice: "female" }]);
  });

  it("teks yang sama dengan suara berbeda adalah dua item (cache-nya memang terpisah)", () => {
    const items = lessonAudioItems({ vocab: [{ surface: "あ" }], sentences: [{ surface: "あ", voice: "male" }] });

    expect(items).toEqual([
      { text: "あ", voice: "female" },
      { text: "あ", voice: "male" },
    ]);
  });

  it("konten kosong menghasilkan daftar kosong", () => {
    expect(lessonAudioItems({ vocab: [], sentences: [] })).toEqual([]);
  });
});

const ITEMS: LessonAudioItem[] = [
  { text: "あ", voice: "female" },
  { text: "い", voice: "female" },
  { text: "う", voice: "male" },
];

describe("seedLessonAudio", () => {
  it("semua berhasil: ready = total, tanpa failure, tiap item dipanggil sekali dengan teks dan suaranya", async () => {
    const audio = { resolveAudioUrl: vi.fn().mockResolvedValue("http://x/a.mp3") };

    const result = await seedLessonAudio(audio, ITEMS);

    expect(result).toEqual({ total: 3, ready: 3 });
    expect(audio.resolveAudioUrl.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ["あ", "female"],
      ["い", "female"],
      ["う", "male"],
    ]);
  });

  it("berjalan BERURUTAN (satu panggilan TTS pada satu waktu)", async () => {
    let running = 0;
    let maxRunning = 0;
    const audio = {
      resolveAudioUrl: vi.fn().mockImplementation(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running--;
        return "u";
      }),
    };

    await seedLessonAudio(audio, ITEMS);

    expect(maxRunning).toBe(1);
  });

  it("berhenti di kegagalan PERTAMA: item sesudahnya tidak dipanggil, hasil menyebut teks yang gagal dan pesannya", async () => {
    const audio = {
      resolveAudioUrl: vi
        .fn()
        .mockResolvedValueOnce("u1")
        .mockRejectedValueOnce(new Error("401 Incorrect API key"))
        .mockResolvedValue("u3"),
    };

    const result = await seedLessonAudio(audio, ITEMS);

    expect(result).toEqual({ total: 3, ready: 1, failure: { text: "い", message: "401 Incorrect API key" } });
    expect(audio.resolveAudioUrl).toHaveBeenCalledTimes(2);
  });

  it("nilai non-Error yang dilempar tetap dilaporkan sebagai teks, tidak melempar ke pemanggil", async () => {
    const audio = { resolveAudioUrl: vi.fn().mockRejectedValue("gagal-mentah") };

    const result = await seedLessonAudio(audio, ITEMS);

    expect(result.failure).toEqual({ text: "あ", message: "gagal-mentah" });
    expect(result.ready).toBe(0);
  });

  it("refresh diteruskan ke tiap panggilan; tanpa opsi, refresh tidak diaktifkan", async () => {
    const audio = { resolveAudioUrl: vi.fn().mockResolvedValue("u") };

    await seedLessonAudio(audio, ITEMS, { refresh: true });
    expect(audio.resolveAudioUrl.mock.calls.map((c) => c[2])).toEqual([{ refresh: true }, { refresh: true }, { refresh: true }]);

    audio.resolveAudioUrl.mockClear();
    await seedLessonAudio(audio, ITEMS);
    expect(audio.resolveAudioUrl.mock.calls.map((c) => (c[2] as { refresh?: boolean }).refresh)).toEqual([undefined, undefined, undefined]);
  });

  it("onProgress dipanggil setelah tiap item yang berhasil (ready, total), dan tidak untuk yang gagal", async () => {
    const onProgress = vi.fn();
    const audio = { resolveAudioUrl: vi.fn().mockResolvedValueOnce("u").mockResolvedValueOnce("u").mockRejectedValueOnce(new Error("x")) };

    await seedLessonAudio(audio, ITEMS, { onProgress });

    expect(onProgress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
    ]);
  });

  it("daftar kosong: selesai seketika tanpa memanggil apa pun", async () => {
    const audio = { resolveAudioUrl: vi.fn() };

    expect(await seedLessonAudio(audio, [])).toEqual({ total: 0, ready: 0 });
    expect(audio.resolveAudioUrl).not.toHaveBeenCalled();
  });
});
