import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { OpenAiTutorLlmClient, UnconfiguredTutorLlmClient } from "./tutor-llm.client";
import { OpenAiSpeechToTextClient, UnconfiguredSpeechToTextClient } from "./tutor-stt.client";
import { OpenAiTutorTtsClient, UnconfiguredTutorTtsClient } from "./tutor-tts.client";

// Klien OpenAI NYATA (SDK `openai` sungguhan, bukan di-mock) melawan server
// HTTP lokal yang menirukan bentuk respons OpenAI. Ini yang bisa diverifikasi
// tanpa kredensial: bentuk request yang benar-benar dikirim SDK (path, header,
// body, multipart) dan pemetaan respons/error-nya. Perilaku model, akurasi
// transkripsi, dan kualitas suara TIDAK teruji di sini -- itu hanya bisa dengan
// OPENAI_API_KEY sungguhan (dicatat di docs/PLAN.md).
//
// SDK membaca `OPENAI_BASE_URL` saat konstruksi klien, jadi variabel itu
// di-set sebelum tiap klien dibuat dan dikembalikan di akhir.

interface Recorded {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: Buffer;
}

let server: Server;
let requests: Recorded[] = [];
let handler: (req: Recorded, res: ServerResponse) => void;
let previousBaseUrl: string | undefined;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function responsesBody(text: string | null) {
  return {
    id: "resp_test",
    object: "response",
    created_at: 1,
    status: "completed",
    model: "test-model",
    output:
      text === null
        ? []
        : [{ type: "message", id: "msg_1", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] }],
    parallel_tool_calls: true,
    tool_choice: "auto",
    tools: [],
  };
}

const json = (req: Recorded) => JSON.parse(req.body.toString("utf8")) as Record<string, unknown>;

/** Nilai field teks dari body multipart mentah. */
function multipartField(req: Recorded, name: string): string | undefined {
  const match = new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)\\r\\n`).exec(req.body.toString("latin1"));
  return match?.[1];
}

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

describe("OpenAiTutorLlmClient (SDK nyata vs server tiruan)", () => {
  it("POST /responses dengan kunci API, model, instructions, input, dan store:false; balasan di-trim", async () => {
    handler = (_req, res) => sendJson(res, 200, responsesBody("  こんにちは！\n"));
    const client = new OpenAiTutorLlmClient("sk-test-key", "model-uji");

    const reply = await client.reply({ instructions: "atur perilaku", input: "user: はじめまして" });

    expect(reply).toBe("こんにちは！");
    expect(requests).toHaveLength(1);
    const [req] = requests;
    expect(req!.method).toBe("POST");
    expect(req!.url).toBe("/v1/responses");
    expect(req!.headers.authorization).toBe("Bearer sk-test-key");
    expect(json(req!)).toEqual({ model: "model-uji", instructions: "atur perilaku", input: "user: はじめまして", store: false });
  });

  it("output kosong -> error (bukan balasan kosong yang diam-diam dianggap sukses)", async () => {
    handler = (_req, res) => sendJson(res, 200, responsesBody(null));
    const client = new OpenAiTutorLlmClient("sk-test-key", "model-uji");

    await expect(client.reply({ instructions: "i", input: "user: a" })).rejects.toThrow(/kosong/);
  });

  it("teks hanya spasi juga dianggap kosong", async () => {
    handler = (_req, res) => sendJson(res, 200, responsesBody("   \n "));
    const client = new OpenAiTutorLlmClient("sk-test-key", "model-uji");

    await expect(client.reply({ instructions: "i", input: "user: a" })).rejects.toThrow(/kosong/);
  });

  it("401 dari provider -> error membawa `status` (dibaca logUpstreamFailure) dan TIDAK di-retry", async () => {
    handler = (_req, res) => sendJson(res, 401, { error: { message: "Incorrect API key provided" } });
    const client = new OpenAiTutorLlmClient("sk-salah", "model-uji");

    const error = await client.reply({ instructions: "i", input: "user: a" }).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 401 });
    expect(requests).toHaveLength(1);
  });

  it("5xx di-retry SEKALI saja (maxRetries 1) -- kasus terburuk terukur, bukan 2 retry bawaan SDK", async () => {
    handler = (_req, res) => sendJson(res, 500, { error: { message: "boom" } });
    const client = new OpenAiTutorLlmClient("sk-test-key", "model-uji");

    const error = await client.reply({ instructions: "i", input: "user: a" }).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 500 });
    expect(requests).toHaveLength(2); // 1 percobaan + 1 retry
  });

  it("5xx sesaat lalu pulih pada retry -> sukses", async () => {
    let calls = 0;
    handler = (_req, res) => (++calls === 1 ? sendJson(res, 500, { error: { message: "sesaat" } }) : sendJson(res, 200, responsesBody("はい")));
    const client = new OpenAiTutorLlmClient("sk-test-key", "model-uji");

    expect(await client.reply({ instructions: "i", input: "user: a" })).toBe("はい");
    expect(requests).toHaveLength(2);
  });
});

describe("OpenAiSpeechToTextClient (SDK nyata vs server tiruan)", () => {
  it("POST multipart /audio/transcriptions: model, language=ja, file bernama recording.<ext> bertipe benar; teks di-trim", async () => {
    handler = (_req, res) => sendJson(res, 200, { text: " はじめまして \n" });
    const client = new OpenAiSpeechToTextClient("sk-test-key", "stt-uji");
    const audio = Buffer.from("BYTES-REKAMAN-PALSU");

    const text = await client.transcribe({ audio, filename: "recording.webm", mimetype: "audio/webm" });

    expect(text).toBe("はじめまして");
    const [req] = requests;
    expect(req!.method).toBe("POST");
    expect(req!.url).toBe("/v1/audio/transcriptions");
    expect(req!.headers.authorization).toBe("Bearer sk-test-key");
    expect(req!.headers["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
    expect(multipartField(req!, "model")).toBe("stt-uji");
    expect(multipartField(req!, "language")).toBe("ja");
    const raw = req!.body.toString("latin1");
    expect(raw).toContain('name="file"; filename="recording.webm"');
    expect(raw).toContain("Content-Type: audio/webm");
    expect(raw).toContain("BYTES-REKAMAN-PALSU");
  });

  it("error provider dilempar ke pemanggil (TutorService yang menerjemahkannya jadi 502)", async () => {
    handler = (_req, res) => sendJson(res, 400, { error: { message: "Invalid file format" } });
    const client = new OpenAiSpeechToTextClient("sk-test-key", "stt-uji");

    const error = await client.transcribe({ audio: Buffer.from("x"), filename: "recording.ogg", mimetype: "audio/ogg" }).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 400 });
    expect(requests).toHaveLength(1); // 4xx biasa tidak dicoba ulang
  });

  // Retry bawaan SDK `openai` v4 untuk unggahan multipart mengirim ulang HEADER tanpa ISI, sehingga permintaan ulang
  // menggantung sampai timeout 45 detik. Itu sebabnya klien ini mencoba ulang sendiri dengan berkas yang dibuat baru.
  describe("percobaan ulang unggahan suara", () => {
    const upload = { audio: Buffer.from("BYTES-REKAMAN-PALSU"), filename: "recording.webm", mimetype: "audio/webm" };

    it("5xx sesaat lalu pulih -> sukses, dan permintaan ulang membawa berkas yang UTUH", async () => {
      let calls = 0;
      handler = (_req, res) => (++calls === 1 ? sendJson(res, 500, { error: { message: "sesaat" } }) : sendJson(res, 200, { text: "もういちど" }));
      const client = new OpenAiSpeechToTextClient("sk-test-key", "stt-uji");

      const text = await client.transcribe(upload);

      expect(text).toBe("もういちど");
      expect(requests).toHaveLength(2);
      for (const req of requests) {
        const raw = req.body.toString("latin1");
        expect(raw).toContain('name="file"; filename="recording.webm"');
        expect(raw).toContain("BYTES-REKAMAN-PALSU");
        expect(multipartField(req, "language")).toBe("ja");
        expect(multipartField(req, "model")).toBe("stt-uji");
      }
    }, 10_000);

    it("5xx terus-menerus -> dicoba ulang SEKALI saja, lalu galat (dengan status) dilempar", async () => {
      handler = (_req, res) => sendJson(res, 503, { error: { message: "boom" } });
      const client = new OpenAiSpeechToTextClient("sk-test-key", "stt-uji");

      const error = await client.transcribe(upload).catch((e: unknown) => e);

      expect(error).toMatchObject({ status: 503 });
      expect(requests).toHaveLength(2); // 1 percobaan + 1 ulang
    }, 10_000);

    it("429 (terlalu banyak permintaan) dicoba ulang", async () => {
      let calls = 0;
      handler = (_req, res) => (++calls === 1 ? sendJson(res, 429, { error: { message: "rate limit" } }) : sendJson(res, 200, { text: "はい" }));
      const client = new OpenAiSpeechToTextClient("sk-test-key", "stt-uji");

      expect(await client.transcribe(upload)).toBe("はい");
      expect(requests).toHaveLength(2);
    }, 10_000);

    it("sambungan putus di tengah jalan -> dicoba ulang dan pulih", async () => {
      let calls = 0;
      handler = (_req, res) => (++calls === 1 ? res.socket?.destroy() : sendJson(res, 200, { text: "つながった" }));
      const client = new OpenAiSpeechToTextClient("sk-test-key", "stt-uji");

      expect(await client.transcribe(upload)).toBe("つながった");
      expect(requests).toHaveLength(2);
    }, 10_000);

    it.each([400, 401, 413, 415])("%i (salah permintaan/kunci) TIDAK dicoba ulang", async (status) => {
      handler = (_req, res) => sendJson(res, status, { error: { message: "ditolak" } });
      const client = new OpenAiSpeechToTextClient("sk-test-key", "stt-uji");

      const error = await client.transcribe(upload).catch((e: unknown) => e);

      expect(error).toMatchObject({ status });
      expect(requests).toHaveLength(1);
    });
  });
});

describe("OpenAiTutorTtsClient (SDK nyata vs server tiruan)", () => {
  const MP3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0xff, 0xfb, 0x90]); // header ID3 + frame MPEG

  function speechOk(): void {
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "audio/mpeg" });
      res.end(MP3);
    };
  }

  it("POST /audio/speech: model, voice, input, instruksi gaya, mp3; mengembalikan byte audio apa adanya", async () => {
    speechOk();
    const client = new OpenAiTutorTtsClient("sk-test-key", "gpt-4o-mini-tts", "nova");

    const audio = await client.synthesize({ text: "こんにちは", voice: "echo", instructions: "Speak cheerfully." });

    expect(Buffer.compare(audio, MP3)).toBe(0);
    const [req] = requests;
    expect(req!.method).toBe("POST");
    expect(req!.url).toBe("/v1/audio/speech");
    expect(req!.headers.authorization).toBe("Bearer sk-test-key");
    expect(json(req!)).toEqual({
      model: "gpt-4o-mini-tts",
      voice: "echo",
      input: "こんにちは",
      instructions: "Speak cheerfully.",
      response_format: "mp3",
    });
  });

  it("model tts-1: `instructions` TIDAK dikirim (tidak didukung, bisa ditolak 400)", async () => {
    speechOk();
    const client = new OpenAiTutorTtsClient("sk-test-key", "tts-1", "nova");

    await client.synthesize({ text: "こんにちは", voice: "nova", instructions: "Speak cheerfully." });

    expect(json(requests[0]!)).not.toHaveProperty("instructions");
  });

  it("instruksi kosong/spasi = tidak ada instruksi", async () => {
    speechOk();
    const client = new OpenAiTutorTtsClient("sk-test-key", "gpt-4o-mini-tts", "nova");

    await client.synthesize({ text: "こんにちは", voice: "nova", instructions: "   " });

    expect(json(requests[0]!)).not.toHaveProperty("instructions");
  });

  it("error provider dilempar ke pemanggil", async () => {
    handler = (_req, res) => sendJson(res, 429, { error: { message: "rate limited" } });
    const client = new OpenAiTutorTtsClient("sk-test-key", "gpt-4o-mini-tts", "nova");

    const error = await client.synthesize({ text: "こんにちは", voice: "nova" }).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 429 });
  });

  describe("voiceKey (kunci cache audio)", () => {
    const gpt = new OpenAiTutorTtsClient("k", "gpt-4o-mini-tts", "nova");

    it("formatnya openai:{model}:{voice}:{8 hex}", () => {
      expect(gpt.voiceKey("nova", "Speak warmly.")).toMatch(/^openai:gpt-4o-mini-tts:nova:[0-9a-f]{8}$/);
    });

    it("deterministik untuk setelan yang sama", () => {
      expect(gpt.voiceKey("nova", "Speak warmly.")).toBe(gpt.voiceKey("nova", "Speak warmly."));
    });

    it("beda voice / beda instruksi / beda model -> kunci berbeda (audio basi tidak pernah disajikan)", () => {
      const base = gpt.voiceKey("nova", "Speak warmly.");
      expect(gpt.voiceKey("echo", "Speak warmly.")).not.toBe(base);
      expect(gpt.voiceKey("nova", "Speak sternly.")).not.toBe(base);
      expect(new OpenAiTutorTtsClient("k", "gpt-4o-tts-lain", "nova").voiceKey("nova", "Speak warmly.")).not.toBe(base);
    });

    it("tanpa instruksi == instruksi kosong (sama-sama tidak mengubah bunyi)", () => {
      expect(gpt.voiceKey("nova")).toBe(gpt.voiceKey("nova", "  "));
    });

    it("tts-1 mengabaikan instruksi, jadi instruksi berbeda BERBAGI kunci (bunyinya memang identik)", () => {
      const legacy = new OpenAiTutorTtsClient("k", "tts-1", "nova");
      expect(legacy.voiceKey("nova", "Speak warmly.")).toBe(legacy.voiceKey("nova", "Speak sternly."));
      expect(legacy.voiceKey("echo")).not.toBe(legacy.voiceKey("nova"));
    });
  });
});

describe("varian unconfigured (OPENAI_API_KEY kosong)", () => {
  it("LLM: configured=false dan reply menolak", async () => {
    const client = new UnconfiguredTutorLlmClient();
    expect(client.configured).toBe(false);
    await expect(client.reply()).rejects.toThrow("OPENAI_API_KEY");
  });

  it("STT: configured=false dan transcribe menolak", async () => {
    const client = new UnconfiguredSpeechToTextClient();
    expect(client.configured).toBe(false);
    await expect(client.transcribe()).rejects.toThrow("OPENAI_API_KEY");
  });

  it("TTS: configured=false, voice bawaan tetap terbaca, synthesize menolak, tidak ada panggilan jaringan", async () => {
    const client = new UnconfiguredTutorTtsClient("nova");
    expect(client.configured).toBe(false);
    expect(client.defaultVoice).toBe("nova");
    expect(client.voiceKey("nova")).toBe("unconfigured:nova");
    await expect(client.synthesize()).rejects.toThrow("OPENAI_API_KEY");
    expect(requests).toHaveLength(0);
  });
});
