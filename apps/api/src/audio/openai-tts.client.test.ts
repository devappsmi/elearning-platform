import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAiTtsClient } from "./openai-tts.client";

// Klien OpenAI NYATA (SDK `openai` sungguhan, bukan di-mock) melawan server HTTP lokal yang menirukan bentuk respons
// OpenAI -- pola sama dengan tutor/tutor-openai-clients.test.ts. Yang teruji: request yang benar-benar dikirim SDK
// (path, header, body) dan pemetaan respons/galatnya. Kualitas suara Jepang TIDAK teruji di sini -- itu hanya bisa
// didengar dengan kunci sungguhan (`pnpm run tts:sample`, lihat docs/DEPLOY.md).
//
// SDK membaca `OPENAI_BASE_URL` saat konstruksi klien, jadi variabel itu di-set sebelum tiap klien dibuat.

interface Recorded {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: Buffer;
}

const MP3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0xff, 0xfb, 0x90]); // header ID3 + frame MPEG

let server: Server;
let requests: Recorded[] = [];
let handler: (req: Recorded, res: ServerResponse) => void;
let previousBaseUrl: string | undefined;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function speechOk(): void {
  handler = (_req, res) => {
    res.writeHead(200, { "content-type": "audio/mpeg" });
    res.end(MP3);
  };
}

const json = (req: Recorded) => JSON.parse(req.body.toString("utf8")) as Record<string, unknown>;

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const recorded: Recorded = { method: req.method ?? "", url: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) };
      requests.push(recorded);
      handler(recorded, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  previousBaseUrl = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(async () => {
  if (previousBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
  else process.env.OPENAI_BASE_URL = previousBaseUrl;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  requests = [];
  handler = (_req, res) => sendJson(res, 500, { error: { message: "handler belum diatur" } });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const INSTRUCTIONS = "Speak clear Japanese.";

function client(model = "gpt-4o-mini-tts", instructions = INSTRUCTIONS): OpenAiTtsClient {
  return new OpenAiTtsClient("sk-test-key", model, "nova", "onyx", instructions);
}

describe("OpenAiTtsClient (SDK nyata vs server tiruan)", () => {
  it("POST /audio/speech: kunci API, model, suara PEREMPUAN, teks apa adanya, instruksi, mp3; byte audio dikembalikan apa adanya", async () => {
    speechOk();

    const audio = await client().synthesize("こんにちは", "female");

    expect(Buffer.compare(audio, MP3)).toBe(0);
    expect(requests).toHaveLength(1);
    const [req] = requests;
    expect(req!.method).toBe("POST");
    expect(req!.url).toBe("/v1/audio/speech");
    expect(req!.headers.authorization).toBe("Bearer sk-test-key");
    expect(json(req!)).toEqual({
      model: "gpt-4o-mini-tts",
      voice: "nova",
      input: "こんにちは",
      instructions: INSTRUCTIONS,
      response_format: "mp3",
    });
  });

  it("suara LAKI-LAKI memakai suara laki-lakinya, bukan suara perempuan", async () => {
    speechOk();

    await client().synthesize("こんにちは", "male");

    expect(json(requests[0]!).voice).toBe("onyx");
  });

  it("dua suara, dua panggilan: tiap panggilan memakai suaranya sendiri (tidak ada keadaan yang bocor antar panggilan)", async () => {
    speechOk();
    const c = client();

    await c.synthesize("あ", "male");
    await c.synthesize("あ", "female");
    await c.synthesize("い", "male");

    expect(requests.map((r) => json(r).voice)).toEqual(["onyx", "nova", "onyx"]);
    expect(requests.map((r) => json(r).input)).toEqual(["あ", "あ", "い"]);
  });

  it.each(["tts-1", "tts-1-hd"])("model %s: `instructions` TIDAK dikirim (tidak didukung, bisa ditolak 400)", async (model) => {
    speechOk();

    await client(model).synthesize("あ", "female");

    expect(json(requests[0]!)).not.toHaveProperty("instructions");
    expect(json(requests[0]!).model).toBe(model);
  });

  it.each([undefined, "", "   "])("instruksi %j = tidak ada instruksi yang dikirim", async (instructions) => {
    speechOk();

    // Dibuat langsung (bukan lewat helper `client`): parameter bawaan helper akan menggantikan `undefined`.
    await new OpenAiTtsClient("sk-test-key", "gpt-4o-mini-tts", "nova", "onyx", instructions).synthesize("あ", "female");

    expect(json(requests[0]!)).not.toHaveProperty("instructions");
  });

  it("instruksi di-trim sebelum dikirim", async () => {
    speechOk();

    await client("gpt-4o-mini-tts", "  Speak slowly.  ").synthesize("あ", "female");

    expect(json(requests[0]!).instructions).toBe("Speak slowly.");
  });

  it("kunci API di-trim (spasi/baris baru dari salin-tempel tidak menjadi header yang rusak)", async () => {
    speechOk();

    await new OpenAiTtsClient("  sk-test-key\n", "gpt-4o-mini-tts", "nova", "onyx").synthesize("あ", "female");

    expect(requests[0]!.headers.authorization).toBe("Bearer sk-test-key");
  });

  it("konfigurasi: configured=true bila ada kunci, false bila kosong/spasi/undefined", () => {
    expect(client().configured).toBe(true);
    expect(new OpenAiTtsClient(undefined, "m", "nova", "onyx").configured).toBe(false);
    expect(new OpenAiTtsClient("", "m", "nova", "onyx").configured).toBe(false);
    expect(new OpenAiTtsClient("   ", "m", "nova", "onyx").configured).toBe(false);
  });

  it("tanpa kunci: menolak dengan pesan yang menyebut OPENAI_API_KEY dan TTS_PROVIDER, TANPA panggilan jaringan", async () => {
    const c = new OpenAiTtsClient(undefined, "gpt-4o-mini-tts", "nova", "onyx");

    const error = await c.synthesize("あ", "female").catch((e: unknown) => e as Error);

    expect(error.message).toContain("OPENAI_API_KEY");
    expect(error.message).toContain("TTS_PROVIDER=openai");
    expect(requests).toHaveLength(0);
  });

  it("tanpa kunci TIDAK diam-diam memakai OPENAI_API_KEY dari environment proses (kunci hanya dari yang diberikan pemanggil)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-dari-environment");
    const c = new OpenAiTtsClient(undefined, "gpt-4o-mini-tts", "nova", "onyx");

    expect(c.configured).toBe(false);
    await expect(c.synthesize("あ", "female")).rejects.toThrow("OPENAI_API_KEY belum diisi");
    expect(requests).toHaveLength(0);
  });

  it("galat penyedia (401): pesan memuat model, suara, dan alasan dari penyedia", async () => {
    handler = (_req, res) => sendJson(res, 401, { error: { message: "Incorrect API key provided." } });

    const error = await client().synthesize("あ", "male").catch((e: unknown) => e as Error);

    expect(error.message).toContain("OpenAI TTS gagal");
    expect(error.message).toContain("gpt-4o-mini-tts");
    expect(error.message).toContain("onyx");
    expect(error.message).toContain("401");
    expect(error.message).toContain("Incorrect API key provided.");
    expect(requests).toHaveLength(1); // 401 tidak diulang
  });

  it("galat model tidak ada (404): alasan dari penyedia ikut terbaca, supaya OPENAI_TTS_MODEL yang salah mudah dikenali", async () => {
    handler = (_req, res) => sendJson(res, 404, { error: { message: "The model `gpt-salah` does not exist", code: "model_not_found" } });

    const error = await client("gpt-salah").synthesize("あ", "female").catch((e: unknown) => e as Error);

    expect(error.message).toContain("gpt-salah");
    expect(error.message).toContain("does not exist");
  });

  it("potongan kunci API di dalam pesan galat penyedia disamarkan (log seed tidak boleh menyimpannya)", async () => {
    // Kunci PALSU, dirangkai dari potongan supaya tak ada string berbentuk kunci sungguhan di repo (pemindai rahasia).
    const fakeKey = ["sk", "proj", "abcdEFGH1234567890xyz"].join("-");
    handler = (_req, res) =>
      sendJson(res, 401, { error: { message: `Incorrect API key provided: ${fakeKey}. You can find your API key at https://platform.openai.com.` } });

    const error = await client().synthesize("あ", "female").catch((e: unknown) => e as Error);

    expect(error.message).not.toContain("abcdEFGH1234567890xyz");
    expect(error.message).not.toContain("sk-proj-");
    expect(error.message).toContain("sk-***");
    expect(error.message).toContain("https://platform.openai.com"); // sisa pesan tetap utuh
  });

  it("penyamaran tidak menyentuh kata biasa yang kebetulan memuat 'sk-'", async () => {
    handler = (_req, res) => sendJson(res, 400, { error: { message: "task-force-alpha is not a valid voice" } });

    const error = await client().synthesize("あ", "female").catch((e: unknown) => e as Error);

    expect(error.message).toContain("task-force-alpha is not a valid voice");
  });

  it("badan respons kosong ditolak (jangan sampai berkas 0 byte tersimpan di cache sebagai audio yang 'sudah ada')", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "audio/mpeg" });
      res.end();
    };

    const error = await client().synthesize("あ", "female").catch((e: unknown) => e as Error);

    expect(error.message).toContain("audio kosong");
    expect(error.message).toContain("あ");
  });
});
