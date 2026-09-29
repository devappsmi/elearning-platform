import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { AudioService } from "../audio/audio.service";
import type { ObjectStorageService } from "../audio/object-storage.service";
import type { TtsClient } from "../audio/tts-client";
import { TutorService } from "./tutor.service";
import { TutorQuota, type TutorQuotaStatus } from "./tutor-quota";
import { nextLocalMidnight, quotaKey } from "./tutor-quota.util";
import { TutorLlmClient, UnconfiguredTutorLlmClient } from "./tutor-llm.client";
import { SpeechToTextClient, UnconfiguredSpeechToTextClient, type TutorAudioUpload } from "./tutor-stt.client";
import { TutorTtsClient, UnconfiguredTutorTtsClient, type TutorSynthesisRequest } from "./tutor-tts.client";
import { TUTOR_CHARACTERS, TUTOR_SCENARIOS } from "./tutor.const";

// ---------------------------------------------------------------- fakes ----

/** Kuota di memori dengan semantik yang sama dengan `RedisTutorQuota` (kunci
 * per murid+hari lokal, tidak pernah melewati limit, refund tidak pernah di
 * bawah 0). Atomisitas SUNGGUHAN (Lua di Redis) diverifikasi terpisah di e2e
 * dengan Redis nyata -- di sini yang diuji adalah orkestrasi `TutorService`. */
class InMemoryQuota extends TutorQuota {
  readonly counters = new Map<string, number>();
  readonly consumeNows: Date[] = [];
  readonly refundNows: Date[] = [];
  failRefund = false;

  constructor(readonly limit: number) {
    super();
  }

  usedOn(userId: string, day: Date): number {
    return this.counters.get(quotaKey(userId, day)) ?? 0;
  }

  private statusFor(used: number, now: Date): TutorQuotaStatus {
    return { limit: this.limit, used, remaining: this.limit - used, resetsAt: nextLocalMidnight(now) };
  }

  async status(userId: string, now: Date): Promise<TutorQuotaStatus> {
    return this.statusFor(this.usedOn(userId, now), now);
  }

  async consume(userId: string, now: Date): Promise<TutorQuotaStatus | null> {
    this.consumeNows.push(now);
    const used = this.usedOn(userId, now);
    if (used >= this.limit) return null;
    this.counters.set(quotaKey(userId, now), used + 1);
    return this.statusFor(used + 1, now);
  }

  async refund(userId: string, now: Date): Promise<void> {
    this.refundNows.push(now);
    if (this.failRefund) throw new Error("redis down");
    const key = quotaKey(userId, now);
    this.counters.set(key, Math.max(0, (this.counters.get(key) ?? 0) - 1));
  }
}

class FakeLlm extends TutorLlmClient {
  readonly reply = vi.fn<(params: { instructions: string; input: string }) => Promise<string>>().mockResolvedValue("こんにちは！");
  constructor(readonly configured = true) {
    super();
  }
}

class FakeStt extends SpeechToTextClient {
  readonly transcribe = vi.fn<(upload: TutorAudioUpload) => Promise<string>>().mockResolvedValue("はじめまして");
  constructor(readonly configured = true) {
    super();
  }
}

class FakeTts extends TutorTtsClient {
  readonly defaultVoice = "nova";
  readonly synthesize = vi.fn<(request: TutorSynthesisRequest) => Promise<Buffer>>().mockResolvedValue(Buffer.from("fake-mp3"));
  constructor(readonly configured = true) {
    super();
  }
  voiceKey(voice: string, instructions?: string): string {
    return `fake:${voice}:${instructions ?? ""}`;
  }
}

/** `AudioService` NYATA di atas prisma/storage di memori -- supaya jalur
 * cache-by-hash (yang dipakai `/tutor/speak`) ikut teruji, bukan di-mock. */
function memoryAudio() {
  const rows = new Map<string, { s3Url: string }>();
  const prisma = {
    audioAsset: {
      findUnique: vi.fn(async ({ where }: { where: { textHash: string } }) => rows.get(where.textHash) ?? null),
      upsert: vi.fn(async ({ where, create }: { where: { textHash: string }; create: { s3Url: string } }) => {
        const existing = rows.get(where.textHash);
        if (existing) return existing;
        rows.set(where.textHash, create);
        return create;
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as PrismaClient;
  const storage = {
    upload: vi.fn(async (key: string) => `http://fake-s3/${key}`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as ObjectStorageService;
  // TtsClient (Azure) milik AudioModule TIDAK boleh tersentuh oleh tutor.
  const azure: TtsClient = { synthesize: vi.fn().mockRejectedValue(new Error("Azure TtsClient tidak boleh dipakai tutor")) };
  return { service: new AudioService(prisma, azure, storage), prisma, storage, azure, rows };
}

function setup(options: { limit?: number; llm?: FakeLlm; stt?: FakeStt; tts?: FakeTts } = {}) {
  const quota = new InMemoryQuota(options.limit ?? 5);
  const llm = options.llm ?? new FakeLlm();
  const stt = options.stt ?? new FakeStt();
  const tts = options.tts ?? new FakeTts();
  const audio = memoryAudio();
  const service = new TutorService(quota, llm, stt, tts, audio.service);
  return { service, quota, llm, stt, tts, audio };
}

async function failure(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    return error as HttpException;
  }
  throw new Error("Panggilan seharusnya ditolak, tapi berhasil");
}

const USER = "murid-1";
const scenarioId = TUTOR_SCENARIOS[0]!.id;
const history = [{ role: "user" as const, text: "はじめまして" }];

afterEach(() => {
  vi.useRealTimers();
});

// -------------------------------------------------------------- catalog ----

describe("TutorService.catalog", () => {
  it("daftar skenario+karakter untuk UI, TANPA system prompt maupun detail suara", () => {
    const { service } = setup();
    const catalog = service.catalog();

    expect(catalog.scenarios.map((s) => s.id)).toEqual(TUTOR_SCENARIOS.map((s) => s.id));
    expect(catalog.characters.map((c) => c.id)).toEqual(TUTOR_CHARACTERS.map((c) => c.id));
    for (const scenario of catalog.scenarios) expect(Object.keys(scenario).sort()).toEqual(["description", "id", "title"]);
    for (const character of catalog.characters) expect(Object.keys(character).sort()).toEqual(["id", "name", "personality"]);

    const serialized = JSON.stringify(catalog);
    for (const scenario of TUTOR_SCENARIOS) expect(serialized).not.toContain(scenario.systemPrompt);
    for (const character of TUTOR_CHARACTERS) expect(serialized).not.toContain(character.voiceInstructions);
  });
});

// ---------------------------------------------------------------- reply ----

describe("TutorService.reply", () => {
  it("jalur normal: balasan LLM + kuota SESUDAH balasan ini; prompt memuat skenario, karakter bawaan (Yuki), dan riwayat", async () => {
    const { service, llm, quota } = setup({ limit: 5 });

    const result = await service.reply(USER, { scenarioId, history });

    expect(result.reply).toBe("こんにちは！");
    expect(result.quota).toMatchObject({ limit: 5, used: 1, remaining: 4 });
    expect(llm.reply).toHaveBeenCalledTimes(1);
    const { instructions, input } = llm.reply.mock.calls[0]![0];
    expect(instructions).toContain(TUTOR_SCENARIOS[0]!.title);
    expect(instructions).toContain("Yuki");
    expect(instructions).not.toContain("MODE BANTUAN");
    expect(input).toBe("user: はじめまして");
    expect(quota.usedOn(USER, new Date())).toBe(1);
  });

  it("mode help + kosakata + karakter pilihan diteruskan ke prompt", async () => {
    const { service, llm } = setup();

    await service.reply(USER, { scenarioId, characterId: "sora", history, vocab: ["りんご"], mode: "help" });

    const { instructions } = llm.reply.mock.calls[0]![0];
    expect(instructions).toContain("Sora");
    expect(instructions).toContain("りんご");
    expect(instructions).toContain("MODE BANTUAN");
  });

  it("skenario tak dikenal -> 400, LLM dan kuota tidak tersentuh", async () => {
    const { service, llm, quota } = setup();

    const error = await failure(service.reply(USER, { scenarioId: "tidak-ada", history }));

    expect(error).toBeInstanceOf(BadRequestException);
    expect(llm.reply).not.toHaveBeenCalled();
    expect(quota.consumeNows).toHaveLength(0);
  });

  it("karakter tak dikenal -> 400, kuota tidak tersentuh", async () => {
    const { service, quota } = setup();

    const error = await failure(service.reply(USER, { scenarioId, characterId: "tidak-ada", history }));

    expect(error).toBeInstanceOf(BadRequestException);
    expect(quota.consumeNows).toHaveLength(0);
  });

  it("giliran terakhir dari assistant -> 400, kuota tidak tersentuh", async () => {
    const { service, llm, quota } = setup();

    const error = await failure(
      service.reply(USER, {
        scenarioId,
        history: [
          { role: "user", text: "はじめまして" },
          { role: "assistant", text: "こんにちは" },
        ],
      }),
    );

    expect(error).toBeInstanceOf(BadRequestException);
    expect(llm.reply).not.toHaveBeenCalled();
    expect(quota.consumeNows).toHaveLength(0);
  });

  it("LLM belum dikonfigurasi -> 503 SEBELUM kuota (server salah-konfigurasi tidak boleh menghabiskan jatah murid)", async () => {
    const { service, quota } = setup({ llm: new UnconfiguredTutorLlmClient() as unknown as FakeLlm });

    const error = await failure(service.reply(USER, { scenarioId, history }));

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(quota.consumeNows).toHaveLength(0);
    expect(quota.usedOn(USER, new Date())).toBe(0);
  });

  it("kuota habis -> 429 dengan status kuota di body; LLM tidak dipanggil; counter tidak naik", async () => {
    const { service, llm, quota } = setup({ limit: 2 });
    await service.reply(USER, { scenarioId, history });
    await service.reply(USER, { scenarioId, history });

    const error = await failure(service.reply(USER, { scenarioId, history }));

    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toMatchObject({
      statusCode: 429,
      message: expect.stringContaining("Kuota harian"),
      quota: { limit: 2, used: 2, remaining: 0 },
    });
    expect(llm.reply).toHaveBeenCalledTimes(2);
    expect(quota.usedOn(USER, new Date())).toBe(2);
  });

  it("kuota per murid: habisnya satu murid tidak mengunci murid lain", async () => {
    const { service } = setup({ limit: 1 });
    await service.reply("murid-a", { scenarioId, history });

    const other = await service.reply("murid-b", { scenarioId, history });

    expect(other.quota.used).toBe(1);
  });

  it("LLM gagal -> 502, jatah DIKEMBALIKAN, dan pesan/detail provider tidak bocor ke client", async () => {
    const llm = new FakeLlm();
    llm.reply.mockRejectedValue(Object.assign(new Error("401 Incorrect API key provided: sk-rahasia-123"), { status: 401 }));
    const { service, quota } = setup({ llm });

    const error = await failure(service.reply(USER, { scenarioId, history }));

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(JSON.stringify(error.getResponse())).not.toContain("sk-rahasia-123");
    expect(quota.usedOn(USER, new Date())).toBe(0);
    expect(quota.refundNows).toHaveLength(1);
  });

  it("refund itu sendiri gagal -> tetap 502 (bukan error refund), tidak crash", async () => {
    const llm = new FakeLlm();
    llm.reply.mockRejectedValue(new Error("upstream down"));
    const { service, quota } = setup({ llm });
    quota.failRefund = true;

    const error = await failure(service.reply(USER, { scenarioId, history }));

    expect(error).toBeInstanceOf(BadGatewayException);
  });

  it("refund memakai `now` yang SAMA dengan consume -- walau panggilan LLM melewati tengah malam", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const day1 = new Date(2024, 2, 5, 23, 59, 58);
    const day2 = new Date(2024, 2, 6, 0, 0, 30);
    vi.setSystemTime(day1);

    const llm = new FakeLlm();
    llm.reply.mockImplementation(async () => {
      vi.setSystemTime(day2); // LLM lambat: jam pindah ke hari berikutnya sebelum gagal
      throw new Error("timeout");
    });
    const { service, quota } = setup({ llm });

    await failure(service.reply(USER, { scenarioId, history }));

    expect(quota.consumeNows[0]!.getTime()).toBe(quota.refundNows[0]!.getTime());
    expect(quota.usedOn(USER, day1)).toBe(0); // counter hari tempat jatah DIAMBIL yang dikembalikan
    expect(quota.usedOn(USER, day2)).toBe(0);
  });

  it("balapan di batas: hanya `limit` panggilan yang lolos ke LLM, sisanya 429", async () => {
    const llm = new FakeLlm();
    llm.reply.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve("はい"), 5)));
    const { service } = setup({ limit: 3, llm });

    const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => service.reply(USER, { scenarioId, history })));

    const ok = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o): o is PromiseRejectedResult => o.status === "rejected");
    expect(ok).toHaveLength(3);
    expect(rejected).toHaveLength(7);
    expect(rejected.every((o) => (o.reason as HttpException).getStatus() === 429)).toBe(true);
    expect(llm.reply).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------- quotaStatus ----

describe("TutorService.quotaStatus", () => {
  it("melaporkan pemakaian hari ini tanpa mengonsumsi apa pun", async () => {
    const { service, quota } = setup({ limit: 4 });
    await service.reply(USER, { scenarioId, history });

    const status = await service.quotaStatus(USER);

    expect(status).toMatchObject({ limit: 4, used: 1, remaining: 3 });
    expect(status.resetsAt.getTime()).toBeGreaterThan(Date.now());
    expect(quota.consumeNows).toHaveLength(1); // cuma dari reply, bukan dari status
  });
});

// ----------------------------------------------------------- transcribe ----

describe("TutorService.transcribe", () => {
  const upload = (over: Partial<{ buffer: Buffer; mimetype: string; size: number }> = {}) => ({
    buffer: Buffer.from("rekaman"),
    mimetype: "audio/webm;codecs=opus",
    size: 7,
    ...over,
  });

  it("jalur normal: nama file sintetis + MIME ter-normalisasi diteruskan ke STT, hasilnya dikembalikan", async () => {
    const { service, stt } = setup();

    const result = await service.transcribe(upload());

    expect(result).toEqual({ text: "はじめまして" });
    expect(stt.transcribe).toHaveBeenCalledWith({ audio: Buffer.from("rekaman"), filename: "recording.webm", mimetype: "audio/webm" });
  });

  it("tanpa file -> 400", async () => {
    const { service, stt } = setup();

    expect(await failure(service.transcribe(undefined))).toBeInstanceOf(BadRequestException);
    expect(stt.transcribe).not.toHaveBeenCalled();
  });

  it("file kosong (0 byte) -> 400", async () => {
    const { service, stt } = setup();

    expect(await failure(service.transcribe(upload({ size: 0, buffer: Buffer.alloc(0) })))).toBeInstanceOf(BadRequestException);
    expect(stt.transcribe).not.toHaveBeenCalled();
  });

  it("format tidak didukung -> 415, STT tidak dipanggil", async () => {
    const { service, stt } = setup();

    const error = await failure(service.transcribe(upload({ mimetype: "application/pdf" })));

    expect(error).toBeInstanceOf(UnsupportedMediaTypeException);
    expect(stt.transcribe).not.toHaveBeenCalled();
  });

  it("STT belum dikonfigurasi -> 503", async () => {
    const { service } = setup({ stt: new UnconfiguredSpeechToTextClient() as unknown as FakeStt });

    expect(await failure(service.transcribe(upload()))).toBeInstanceOf(ServiceUnavailableException);
  });

  it("STT gagal -> 502 tanpa membocorkan detail provider", async () => {
    const stt = new FakeStt();
    stt.transcribe.mockRejectedValue(new Error("Incorrect API key sk-rahasia-456"));
    const { service } = setup({ stt });

    const error = await failure(service.transcribe(upload()));

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(JSON.stringify(error.getResponse())).not.toContain("sk-rahasia-456");
  });

  it("transkripsi tidak menyentuh kuota harian (kuota versi lama cuma untuk balasan)", async () => {
    const { service, quota } = setup();

    await service.transcribe(upload());

    expect(quota.consumeNows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- speak ----

describe("TutorService.speak", () => {
  it("tanpa karakter: voice bawaan server, tanpa instruksi gaya; teks di-trim", async () => {
    const { service, tts } = setup();

    const result = await service.speak({ text: "  こんにちは  " });

    expect(tts.synthesize).toHaveBeenCalledWith({ text: "こんにちは", voice: "nova", instructions: undefined });
    expect(result.audioUrl).toMatch(/^http:\/\/fake-s3\/audio\/[0-9a-f]{64}\.mp3$/);
  });

  it("dengan karakter: voice + instruksi gaya milik karakter itu", async () => {
    const { service, tts } = setup();
    const kenji = TUTOR_CHARACTERS.find((c) => c.id === "kenji")!;

    await service.speak({ text: "こんにちは", characterId: "kenji" });

    expect(tts.synthesize).toHaveBeenCalledWith({ text: "こんにちは", voice: kenji.voice, instructions: kenji.voiceInstructions });
  });

  it("karakter tak dikenal -> 400", async () => {
    const { service, tts } = setup();

    expect(await failure(service.speak({ text: "こんにちは", characterId: "tidak-ada" }))).toBeInstanceOf(BadRequestException);
    expect(tts.synthesize).not.toHaveBeenCalled();
  });

  it("teks cuma spasi -> 400 (lolos MinLength(1) di DTO, ditangkap di service)", async () => {
    const { service, tts } = setup();

    expect(await failure(service.speak({ text: "   \n " }))).toBeInstanceOf(BadRequestException);
    expect(tts.synthesize).not.toHaveBeenCalled();
  });

  it("TTS belum dikonfigurasi -> 503", async () => {
    const { service } = setup({ tts: new UnconfiguredTutorTtsClient("nova") as unknown as FakeTts });

    expect(await failure(service.speak({ text: "こんにちは" }))).toBeInstanceOf(ServiceUnavailableException);
  });

  it("cache: teks + karakter yang sama disintesis SEKALI; karakter lain = entri cache lain", async () => {
    const { service, tts, audio } = setup();

    const first = await service.speak({ text: "こんにちは", characterId: "yuki" });
    const again = await service.speak({ text: "こんにちは", characterId: "yuki" });
    const other = await service.speak({ text: "こんにちは", characterId: "kenji" });

    expect(again.audioUrl).toBe(first.audioUrl);
    expect(other.audioUrl).not.toBe(first.audioUrl);
    expect(tts.synthesize).toHaveBeenCalledTimes(2);
    expect(audio.storage.upload).toHaveBeenCalledTimes(2);
    expect(audio.azure.synthesize).not.toHaveBeenCalled();
  });

  it("TTS gagal -> 502 tanpa membocorkan detail, dan tidak ada entri cache setengah jadi", async () => {
    const tts = new FakeTts();
    tts.synthesize.mockRejectedValue(new Error("quota exceeded for key sk-rahasia-789"));
    const { service, audio } = setup({ tts });

    const error = await failure(service.speak({ text: "こんにちは" }));

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(JSON.stringify(error.getResponse())).not.toContain("sk-rahasia-789");
    expect(audio.rows.size).toBe(0);
    expect(audio.storage.upload).not.toHaveBeenCalled();
  });

  it("speak tidak menyentuh kuota harian", async () => {
    const { service, quota } = setup();

    await service.speak({ text: "こんにちは" });

    expect(quota.consumeNows).toHaveLength(0);
  });
});
