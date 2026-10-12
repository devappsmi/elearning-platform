import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioStorage } from "./audio-storage";
import { LocalStorageService } from "./local-storage.service";
import type { TtsClient } from "./tts-client";
import { createTtsClient } from "./tts-factory";
import { resolveTtsOptions } from "./tts-options";
import { runTtsSamples, TTS_SAMPLES } from "./tts-sample";

// Contoh suara dijalankan terhadap penyimpanan LOKAL sungguhan (direktori sementara): yang dibuktikan adalah kunci
// berkas yang benar-benar diterima penyimpanan, isi berkas, dan alamat yang dicetak -- bukan hanya panggilan tiruan.

const BASE_URL = "http://localhost:3001/media";
const OPENAI = { OPENAI_API_KEY: "sk-rahasia-untuk-tes" };

let dir: string;
let storage: LocalStorageService;
let lines: string[];
const log = (line: string): void => {
  lines.push(line);
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "elearning-tts-sample-"));
  storage = new LocalStorageService(dir, BASE_URL);
  lines = [];
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function fakeTts(implementation?: (text: string, voice: "female" | "male") => Promise<Buffer>) {
  return {
    configured: true,
    synthesize: vi.fn(implementation ?? (async (text: string, voice: string) => Buffer.from(`audio:${voice}:${text}`))),
  } satisfies TtsClient;
}

async function files(): Promise<string[]> {
  return (await readdir(join(dir, "samples"))).sort();
}

describe("runTtsSamples", () => {
  it("membuat SEMUA contoh berurutan, sesuai suaranya, dan menyimpan tiap satu di samples/", async () => {
    const options = resolveTtsOptions(OPENAI);
    const tts = fakeTts();

    const result = await runTtsSamples(options, tts, storage, log);

    expect(result).toEqual({ total: TTS_SAMPLES.length, saved: TTS_SAMPLES.length });
    expect(tts.synthesize.mock.calls).toEqual(TTS_SAMPLES.map((s) => [s.text, s.voice]));
    const names = await files();
    expect(names).toHaveLength(TTS_SAMPLES.length);
    // Isi berkas = byte yang dikembalikan penyedia untuk sampel itu (bukan berkas tertukar/terpotong).
    for (const [index, sample] of TTS_SAMPLES.entries()) {
      const name = names.find((n) => n.includes(`-${String(index + 1).padStart(2, "0")}-${sample.voice}.mp3`))!;
      expect(name).toBeDefined();
      expect((await readFile(join(dir, "samples", name))).toString()).toBe(`audio:${sample.voice}:${sample.text}`);
    }
  });

  it("nama berkas: samples/tts-{penyedia}-{sidik}-{nomor}-{suara}.mp3, dan alamat yang dicetak = alamat publik berkas itu", async () => {
    const options = resolveTtsOptions(OPENAI);

    await runTtsSamples(options, fakeTts(), storage, log);

    const names = await files();
    expect(names[0]).toMatch(/^tts-openai-[0-9a-f]{8}-01-female\.mp3$/);
    for (const name of names) expect(lines).toContain(`      ${BASE_URL}/samples/${name}`);
  });

  it("setiap contoh dijelaskan (teks, suara, apa yang didengarkan) dan diberi nomor n/total", async () => {
    await runTtsSamples(resolveTtsOptions(OPENAI), fakeTts(), storage, log);

    const text = lines.join("\n");
    expect(text).toContain(`[1/${TTS_SAMPLES.length}] あ (perempuan)`);
    expect(text).toContain("は (perempuan) -- harus \"ha\"");
    expect(text).toContain("(laki-laki)");
    expect(lines[0]).toContain("openai (model gpt-4o-mini-tts");
  });

  it("berhenti di kegagalan PERTAMA: contoh sesudahnya tidak dibuat, GAGAL + pesan dicetak, hasil menyebut teksnya", async () => {
    const tts = fakeTts(async (text) => {
      if (text === "を") throw new Error("429 quota exceeded");
      return Buffer.from("x");
    });

    const result = await runTtsSamples(resolveTtsOptions(OPENAI), tts, storage, log);

    expect(result).toEqual({ total: TTS_SAMPLES.length, saved: 2, failure: { text: "を", message: "429 quota exceeded" } });
    expect(tts.synthesize).toHaveBeenCalledTimes(3);
    expect(await files()).toHaveLength(2);
    expect(lines.join("\n")).toContain("GAGAL: 429 quota exceeded");
  });

  it("klien belum dikonfigurasi: gagal di contoh PERTAMA dengan pesan klien itu sendiri, tanpa menulis apa pun", async () => {
    const options = resolveTtsOptions({ TTS_PROVIDER: "openai" }); // tanpa kunci
    const tts = createTtsClient(options);

    const result = await runTtsSamples(options, tts, storage, log);

    expect(result.saved).toBe(0);
    expect(result.failure?.text).toBe(TTS_SAMPLES[0]!.text);
    expect(result.failure?.message).toContain("OPENAI_API_KEY belum diisi");
    await expect(readdir(join(dir, "samples"))).rejects.toThrow(); // direktori pun tidak dibuat
  });

  it("penyimpanan gagal menulis: dilaporkan sebagai kegagalan (bukan pura-pura sukses)", async () => {
    const broken: AudioStorage = { upload: vi.fn().mockRejectedValue(new Error("EACCES: permission denied")) };

    const result = await runTtsSamples(resolveTtsOptions(OPENAI), fakeTts(), broken, log);

    expect(result.saved).toBe(0);
    expect(result.failure?.message).toContain("EACCES");
    expect(lines.join("\n")).toContain("GAGAL: EACCES");
  });

  it("ganti suara -> berkas BARU (contoh lama tidak disajikan dari cache browser); setelan sama -> berkas yang sama ditimpa", async () => {
    await runTtsSamples(resolveTtsOptions(OPENAI), fakeTts(), storage, log);
    const first = await files();

    await runTtsSamples(resolveTtsOptions(OPENAI), fakeTts(), storage, log);
    expect(await files()).toEqual(first); // sama persis: tidak menumpuk

    await runTtsSamples(resolveTtsOptions({ ...OPENAI, OPENAI_LESSON_TTS_VOICE_FEMALE: "coral" }), fakeTts(), storage, log);
    const all = await files();
    expect(all).toHaveLength(first.length * 2);
    expect(new Set(all).size).toBe(all.length);
  });

  it("penyedia berbeda menghasilkan nama berkas berbeda (bisa dibandingkan berdampingan)", async () => {
    await runTtsSamples(resolveTtsOptions(OPENAI), fakeTts(), storage, log);
    await runTtsSamples(resolveTtsOptions({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "japaneast" }), fakeTts(), storage, log);

    const names = await files();
    expect(names.filter((n) => n.startsWith("tts-openai-"))).toHaveLength(TTS_SAMPLES.length);
    expect(names.filter((n) => n.startsWith("tts-azure-"))).toHaveLength(TTS_SAMPLES.length);
  });

  it("kunci API TIDAK PERNAH muncul di keluaran, termasuk saat gagal", async () => {
    const tts = fakeTts(async () => {
      throw new Error("provider menolak");
    });

    await runTtsSamples(resolveTtsOptions(OPENAI), tts, storage, log);
    await runTtsSamples(resolveTtsOptions(OPENAI), fakeTts(), storage, log);

    expect(lines.join("\n")).not.toContain("sk-rahasia-untuk-tes");
  });
});

describe("TTS_SAMPLES", () => {
  it("mencakup kedua suara dan kasus yang paling sering salah dibaca (は, を, kanji dengan bacaan khusus)", () => {
    const texts = TTS_SAMPLES.map((s) => s.text);
    expect(new Set(TTS_SAMPLES.map((s) => s.voice))).toEqual(new Set(["female", "male"]));
    expect(texts).toEqual(expect.arrayContaining(["あ", "は", "を", "今日"]));
  });

  it("pasangan (teks, suara) unik dan tiap contoh punya catatan", () => {
    const keys = TTS_SAMPLES.map((s) => `${s.voice}|${s.text}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const sample of TTS_SAMPLES) expect(sample.note.trim().length).toBeGreaterThan(0);
  });
});
