import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ConfigService } from "@nestjs/config";
import type { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnv, type Env } from "../config/env.validation";
import { AudioService } from "./audio.service";
import { hashAudioKey } from "./audio-hash.util";
import { AzureTtsClient } from "./azure-tts.client";
import { LocalStorageService } from "./local-storage.service";
import { lessonAudioItems, seedLessonAudio } from "./lesson-audio-seed";
import { ttsClientFromConfig } from "./tts-factory";

// Rantai penuh dari ENV sampai berkas di disk, tanpa satu pun tiruan pada bagian yang sedang dibuktikan:
//   env mentah -> validateEnv (zod) -> ConfigService -> ttsClientFromConfig (yang dipakai AudioModule)
//   -> OpenAiTtsClient -> SDK `openai` sungguhan -> server HTTP lokal penyamar OpenAI
//   -> AudioService -> LocalStorageService (disk sungguhan) -> alamat publik.
// Hanya database yang diganti penyimpanan di memori. Yang TIDAK teruji di sini: suara sungguhan dari OpenAI.

interface Recorded {
  url: string;
  headers: IncomingMessage["headers"];
  body: Record<string, unknown>;
}

const MP3_A = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x0a, 0x0a, 0x0a]);
const MP3_B = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x0b, 0x0b, 0x0b]);

const BASE_ENV = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  JWT_STUDENT_SECRET: "student-secret-0123456789",
  JWT_ADMIN_SECRET: "admin-secret-0123456789",
  MAIL_FROM: "noreply@contoh.id",
  CORS_ORIGIN_STUDENT: "https://app.contoh.id",
  CORS_ORIGIN_ADMIN: "https://admin.contoh.id",
};
const PUBLIC_BASE = "https://app.contoh.id/media";

let server: Server;
let requests: Recorded[] = [];
let respond: (res: ServerResponse) => void;
let previousBaseUrl: string | undefined;
let dir: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      requests.push({ url: req.url ?? "", headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") });
      respond(res);
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

beforeEach(async () => {
  requests = [];
  respond = serveAudio(MP3_A);
  dir = await mkdtemp(join(tmpdir(), "elearning-audio-wiring-"));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

function serveAudio(bytes: Buffer): (res: ServerResponse) => void {
  return (res) => {
    res.writeHead(200, { "content-type": "audio/mpeg" });
    res.end(bytes);
  };
}

/** ConfigService yang membaca env HASIL validateEnv -- sama dengan yang diterima AudioModule saat boot. */
function configFor(raw: Record<string, string | undefined>): ConfigService<Env, true> {
  const validated = validateEnv({ ...BASE_ENV, ...raw });
  return { get: (key: keyof Env) => validated[key] } as unknown as ConfigService<Env, true>;
}

function memoryPrisma() {
  const rows = new Map<string, { textHash: string; textJp: string; s3Url: string }>();
  const prisma = {
    audioAsset: {
      findUnique: async ({ where }: { where: { textHash: string } }) => rows.get(where.textHash) ?? null,
      upsert: async ({ where, update, create }: { where: { textHash: string }; update: Partial<{ s3Url: string }>; create: { textHash: string; textJp: string; s3Url: string } }) => {
        const existing = rows.get(where.textHash);
        if (existing) return Object.assign(existing, update);
        rows.set(where.textHash, { ...create });
        return rows.get(where.textHash)!;
      },
    },
  } as unknown as PrismaClient;
  return { prisma, rows };
}

function audioServiceFor(raw: Record<string, string | undefined>) {
  const { prisma, rows } = memoryPrisma();
  const tts = ttsClientFromConfig(configFor(raw));
  const service = new AudioService(prisma, tts, new LocalStorageService(dir, PUBLIC_BASE));
  return { service, tts, rows };
}

const audioFile = (text: string, voice: string) => join(dir, "audio", `${hashAudioKey(text, voice)}.mp3`);

describe("audio pelajaran lewat OpenAI: dari env sampai berkas", () => {
  it("TTS_PROVIDER=openai: suara dari env dipakai per gender, berkas ditulis di audio/{hash}.mp3, alamat publik = STORAGE base + kunci", async () => {
    const { service, rows } = audioServiceFor({
      TTS_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test-key",
      OPENAI_LESSON_TTS_VOICE_FEMALE: "coral",
      OPENAI_LESSON_TTS_VOICE_MALE: "echo",
    });

    const female = await service.resolveAudioUrl("あ", "female");
    const male = await service.resolveAudioUrl("あ", "male");

    expect(requests.map((r) => r.body.voice)).toEqual(["coral", "echo"]);
    expect(requests.every((r) => r.url === "/v1/audio/speech" && r.headers.authorization === "Bearer sk-test-key")).toBe(true);
    // Kunci cache lesson TIDAK bergantung pada penyedia -- endpoint pelajaran mencari audio dengan hash(teks, 'female'|'male').
    expect(female).toBe(`${PUBLIC_BASE}/audio/${hashAudioKey("あ", "female")}.mp3`);
    expect(male).toBe(`${PUBLIC_BASE}/audio/${hashAudioKey("あ", "male")}.mp3`);
    expect((await readFile(audioFile("あ", "female"))).equals(MP3_A)).toBe(true);
    expect(rows.get(hashAudioKey("あ", "male"))).toMatchObject({ textJp: "あ", s3Url: male });
  });

  it("mode auto: hanya OPENAI_API_KEY (tanpa TTS_PROVIDER) sudah cukup -- memakai OpenAI dengan suara dan instruksi bawaan", async () => {
    const { service } = audioServiceFor({ OPENAI_API_KEY: "sk-test-key" });

    await service.resolveAudioUrl("は", "female");
    await service.resolveAudioUrl("は", "male");

    expect(requests.map((r) => r.body.voice)).toEqual(["nova", "onyx"]);
    expect(requests[0]!.body).toMatchObject({ model: "gpt-4o-mini-tts", input: "は", response_format: "mp3" });
    expect(String(requests[0]!.body.instructions)).toMatch(/Japanese/);
  });

  it("OPENAI_TTS_MODEL=tts-1 dari env: instruksi tidak dikirim", async () => {
    const { service } = audioServiceFor({ OPENAI_API_KEY: "sk-test-key", OPENAI_TTS_MODEL: "tts-1" });

    await service.resolveAudioUrl("あ", "female");

    expect(requests[0]!.body).toMatchObject({ model: "tts-1" });
    expect(requests[0]!.body).not.toHaveProperty("instructions");
  });

  it("OPENAI_LESSON_TTS_INSTRUCTIONS dari env sampai ke request", async () => {
    const { service } = audioServiceFor({ OPENAI_API_KEY: "sk-test-key", OPENAI_LESSON_TTS_INSTRUCTIONS: "Speak very slowly." });

    await service.resolveAudioUrl("あ", "female");

    expect(requests[0]!.body.instructions).toBe("Speak very slowly.");
  });

  it("baris env kosong (`OPENAI_LESSON_TTS_VOICE_MALE=` di .env/compose) = bawaan, bukan suara kosong yang ditolak OpenAI", async () => {
    const { service } = audioServiceFor({ OPENAI_API_KEY: "sk-test-key", OPENAI_LESSON_TTS_VOICE_MALE: "", OPENAI_LESSON_TTS_INSTRUCTIONS: "", TTS_PROVIDER: "" });

    await service.resolveAudioUrl("あ", "male");

    expect(requests[0]!.body.voice).toBe("onyx");
    expect(String(requests[0]!.body.instructions)).toMatch(/Japanese/);
  });

  it("cache hit: panggilan kedua untuk teks+suara yang sama tidak menghubungi OpenAI lagi", async () => {
    const { service } = audioServiceFor({ OPENAI_API_KEY: "sk-test-key" });

    const first = await service.resolveAudioUrl("あ", "female");
    const second = await service.resolveAudioUrl("あ", "female");

    expect(second).toBe(first);
    expect(requests).toHaveLength(1);
  });

  it("Azure lengkap + OpenAI: mode auto memilih Azure; TTS_PROVIDER=openai memaksa OpenAI", () => {
    const both = { OPENAI_API_KEY: "sk-test-key", AZURE_SPEECH_KEY: "kunci-azure", AZURE_SPEECH_REGION: "japaneast" };

    expect(ttsClientFromConfig(configFor(both))).toBeInstanceOf(AzureTtsClient);
    expect(ttsClientFromConfig(configFor({ ...both, TTS_PROVIDER: "openai" }))).not.toBeInstanceOf(AzureTtsClient);
  });

  it.each([
    ["tanpa kredensial apa pun", {}, "Belum ada penyedia TTS"],
    ["TTS_PROVIDER=none walau kunci ada", { TTS_PROVIDER: "none", OPENAI_API_KEY: "sk-test-key" }, "TTS_PROVIDER=none"],
    ["TTS_PROVIDER=openai tanpa kunci", { TTS_PROVIDER: "openai" }, "OPENAI_API_KEY belum diisi"],
  ])("%s: resolveAudioUrl menolak dengan pesan yang jelas, tanpa panggilan jaringan dan tanpa berkas/baris", async (_nama, env, pesan) => {
    const { service, rows } = audioServiceFor(env);

    await expect(service.resolveAudioUrl("あ", "female")).rejects.toThrow(pesan);

    expect(requests).toHaveLength(0);
    expect(rows.size).toBe(0);
    await expect(readdir(join(dir, "audio"))).rejects.toThrow();
  });

  it("kunci ditolak OpenAI (401): tidak ada berkas dan tidak ada baris cache yang tertinggal", async () => {
    respond = (res) => {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Incorrect API key provided." } }));
    };
    const { service, rows } = audioServiceFor({ OPENAI_API_KEY: "sk-salah" });

    await expect(service.resolveAudioUrl("あ", "female")).rejects.toThrow(/OpenAI TTS gagal.*401/);

    expect(rows.size).toBe(0);
    await expect(readdir(join(dir, "audio"))).rejects.toThrow();
  });
});

describe("refresh (SEED_AUDIO_REGENERATE): mengganti audio yang sudah ada", () => {
  it("tanpa refresh audio lama dipertahankan; dengan refresh berkas ditimpa di kunci yang SAMA (URL tetap) dan tidak ada baris ganda", async () => {
    const { service, rows } = audioServiceFor({ OPENAI_API_KEY: "sk-test-key" });
    const url = await service.resolveAudioUrl("あ", "female");
    expect((await readFile(audioFile("あ", "female"))).equals(MP3_A)).toBe(true);

    respond = serveAudio(MP3_B);
    expect(await service.resolveAudioUrl("あ", "female")).toBe(url);
    expect(requests).toHaveLength(1); // cache hit, tidak memanggil OpenAI
    expect((await readFile(audioFile("あ", "female"))).equals(MP3_A)).toBe(true);

    expect(await service.resolveAudioUrl("あ", "female", { refresh: true })).toBe(url);
    expect(requests).toHaveLength(2);
    expect((await readFile(audioFile("あ", "female"))).equals(MP3_B)).toBe(true);
    expect(rows.size).toBe(1);
    expect(await readdir(join(dir, "audio"))).toEqual([`${hashAudioKey("あ", "female")}.mp3`]); // tanpa sisa berkas sementara
  });

  it("refresh yang GAGAL tidak merusak: audio lama tetap ada di disk dan barisnya tetap", async () => {
    const { service, rows } = audioServiceFor({ OPENAI_API_KEY: "sk-test-key" });
    const url = await service.resolveAudioUrl("あ", "female");

    respond = (res) => {
      res.writeHead(429, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "You exceeded your current quota" } }));
    };
    await expect(service.resolveAudioUrl("あ", "female", { refresh: true })).rejects.toThrow(/OpenAI TTS gagal.*429/);

    expect((await readFile(audioFile("あ", "female"))).equals(MP3_A)).toBe(true);
    expect(rows.get(hashAudioKey("あ", "female"))?.s3Url).toBe(url);
  });

  it("seedLessonAudio dengan refresh: SEMUA item dibuat ulang; kegagalan di tengah menyisakan audio lama untuk sisanya", async () => {
    const { service } = audioServiceFor({ OPENAI_API_KEY: "sk-test-key" });
    const items = lessonAudioItems({ vocab: [{ surface: "あ" }, { surface: "い" }, { surface: "う" }], sentences: [] });
    expect(await seedLessonAudio(service, items)).toEqual({ total: 3, ready: 3 });
    expect(requests).toHaveLength(3);

    // Ganti "suara": OpenAI sekarang mengembalikan MP3_B, tetapi menolak permintaan ketiga. (401, bukan 500: SDK
    // mengulang sekali untuk 5xx/429, dan ulangannya akan berhasil sehingga kegagalan tak pernah sampai ke seed.)
    let served = 0;
    respond = (res) => {
      served++;
      if (served === 3) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Incorrect API key provided." } }));
        return;
      }
      serveAudio(MP3_B)(res);
    };
    requests = [];
    const result = await seedLessonAudio(service, items, { refresh: true });

    expect(result.ready).toBe(2);
    expect(result.failure?.text).toBe("う");
    expect((await readFile(audioFile("あ", "female"))).equals(MP3_B)).toBe(true);
    expect((await readFile(audioFile("い", "female"))).equals(MP3_B)).toBe(true);
    expect((await readFile(audioFile("う", "female"))).equals(MP3_A)).toBe(true); // yang gagal tetap punya audio lamanya
  });
});
