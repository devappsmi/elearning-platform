import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { createValidationPipe } from "../common/validation";
import {
  MAX_HISTORY_TURNS,
  MAX_TURN_CHARS,
  MAX_VOCAB_CHARS,
  MAX_VOCAB_ITEMS,
  TutorReplyRequestDto,
  TutorTurnDto,
} from "./dto/tutor-reply.dto";
import { MAX_SPEAK_CHARS, TutorSpeakRequestDto } from "./dto/tutor-speech.dto";

// Pipe yang SAMA dengan yang didaftarkan global (APP_PIPE, common/validation.ts).
// `metatype` diberikan manual: vitest (esbuild) tidak menghasilkan
// `design:paramtypes`, yang di runtime sungguhan (tsc/nest build) mengisinya
// otomatis dari tipe parameter. Bahwa pipe ini benar-benar terpasang di route
// dijaga oleh common/validation.test.ts + diverifikasi lewat server nyata (e2e).
const pipe = createValidationPipe();

const validate = <T>(value: unknown, metatype: new () => T): Promise<T> =>
  pipe.transform(value, { type: "body", metatype }) as Promise<T>;

async function messagesOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return JSON.stringify((error as BadRequestException).getResponse());
  }
  throw new Error("Validasi seharusnya menolak input ini, tapi lolos");
}

const turn = (text = "はじめまして", role: string = "user") => ({ role, text });
const validReply = () => ({ scenarioId: "perkenalan", history: [turn()] });

describe("TutorReplyRequestDto (batas pengaman biaya token)", () => {
  it("request minimal yang sah lolos dan berubah jadi instance DTO (termasuk turn bersarang)", async () => {
    const dto = await validate(validReply(), TutorReplyRequestDto);

    expect(dto).toBeInstanceOf(TutorReplyRequestDto);
    expect(dto.history[0]).toBeInstanceOf(TutorTurnDto);
  });

  it("request lengkap lolos (karakter, kosakata, mode help)", async () => {
    const dto = await validate(
      { ...validReply(), characterId: "kenji", vocab: ["りんご", "みず"], mode: "help" },
      TutorReplyRequestDto,
    );

    expect(dto.mode).toBe("help");
    expect(dto.vocab).toEqual(["りんご", "みず"]);
  });

  it("scenarioId wajib dan tidak boleh kosong", async () => {
    expect(await messagesOf(validate({ history: [turn()] }, TutorReplyRequestDto))).toContain("scenarioId");
    expect(await messagesOf(validate({ ...validReply(), scenarioId: "" }, TutorReplyRequestDto))).toContain("scenarioId");
  });

  describe("history", () => {
    it("wajib ada dan tidak boleh kosong", async () => {
      expect(await messagesOf(validate({ scenarioId: "perkenalan" }, TutorReplyRequestDto))).toContain("history");
      expect(await messagesOf(validate({ scenarioId: "perkenalan", history: [] }, TutorReplyRequestDto))).toContain("history");
    });

    it(`maksimal ${MAX_HISTORY_TURNS} giliran (${MAX_HISTORY_TURNS} lolos, ${MAX_HISTORY_TURNS + 1} ditolak)`, async () => {
      const make = (n: number) => ({ scenarioId: "perkenalan", history: Array.from({ length: n }, () => turn()) });

      await expect(validate(make(MAX_HISTORY_TURNS), TutorReplyRequestDto)).resolves.toBeDefined();
      expect(await messagesOf(validate(make(MAX_HISTORY_TURNS + 1), TutorReplyRequestDto))).toContain("history");
    });

    it(`teks satu giliran maksimal ${MAX_TURN_CHARS} karakter`, async () => {
      const make = (text: string) => ({ scenarioId: "perkenalan", history: [turn(text)] });

      await expect(validate(make("あ".repeat(MAX_TURN_CHARS)), TutorReplyRequestDto)).resolves.toBeDefined();
      expect(await messagesOf(validate(make("あ".repeat(MAX_TURN_CHARS + 1)), TutorReplyRequestDto))).toContain("text");
    });

    it("teks giliran tidak boleh kosong dan harus string", async () => {
      expect(await messagesOf(validate({ scenarioId: "p", history: [turn("")] }, TutorReplyRequestDto))).toContain("text");
      expect(await messagesOf(validate({ scenarioId: "p", history: [{ role: "user", text: 123 }] }, TutorReplyRequestDto))).toContain("text");
    });

    it("role hanya user/assistant (mis. 'system' ditolak -- murid tidak boleh menyuntik peran)", async () => {
      expect(await messagesOf(validate({ scenarioId: "p", history: [turn("hai", "system")] }, TutorReplyRequestDto))).toContain("role");
    });

    it("bukan array ditolak", async () => {
      expect(await messagesOf(validate({ scenarioId: "p", history: "user: hai" }, TutorReplyRequestDto))).toContain("history");
    });

    it("field tak dikenal di dalam giliran ditolak", async () => {
      const body = { scenarioId: "p", history: [{ role: "user", text: "hai", extra: "x" }] };
      expect(await messagesOf(validate(body, TutorReplyRequestDto))).toContain("extra");
    });
  });

  describe("vocab", () => {
    it(`maksimal ${MAX_VOCAB_ITEMS} kata (${MAX_VOCAB_ITEMS} lolos, ${MAX_VOCAB_ITEMS + 1} ditolak)`, async () => {
      const make = (n: number) => ({ ...validReply(), vocab: Array.from({ length: n }, (_, i) => `kata${i}`) });

      await expect(validate(make(MAX_VOCAB_ITEMS), TutorReplyRequestDto)).resolves.toBeDefined();
      expect(await messagesOf(validate(make(MAX_VOCAB_ITEMS + 1), TutorReplyRequestDto))).toContain("vocab");
    });

    it(`tiap kata maksimal ${MAX_VOCAB_CHARS} karakter dan harus string`, async () => {
      await expect(validate({ ...validReply(), vocab: ["あ".repeat(MAX_VOCAB_CHARS)] }, TutorReplyRequestDto)).resolves.toBeDefined();
      expect(await messagesOf(validate({ ...validReply(), vocab: ["あ".repeat(MAX_VOCAB_CHARS + 1)] }, TutorReplyRequestDto))).toContain("vocab");
      expect(await messagesOf(validate({ ...validReply(), vocab: [123] }, TutorReplyRequestDto))).toContain("vocab");
    });
  });

  it("mode hanya roleplay/help", async () => {
    expect(await messagesOf(validate({ ...validReply(), mode: "hack" }, TutorReplyRequestDto))).toContain("mode");
  });

  it("field tak dikenal ditolak (forbidNonWhitelisted), mis. client mencoba menyuntik `quota`", async () => {
    expect(await messagesOf(validate({ ...validReply(), quota: { remaining: 999 } }, TutorReplyRequestDto))).toContain("quota");
  });
});

describe("TutorSpeakRequestDto", () => {
  it("teks saja sudah cukup; karakter opsional", async () => {
    await expect(validate({ text: "こんにちは" }, TutorSpeakRequestDto)).resolves.toBeInstanceOf(TutorSpeakRequestDto);
    await expect(validate({ text: "こんにちは", characterId: "yuki" }, TutorSpeakRequestDto)).resolves.toBeDefined();
  });

  it(`teks maksimal ${MAX_SPEAK_CHARS} karakter (biaya sintesis per karakter)`, async () => {
    await expect(validate({ text: "あ".repeat(MAX_SPEAK_CHARS) }, TutorSpeakRequestDto)).resolves.toBeDefined();
    expect(await messagesOf(validate({ text: "あ".repeat(MAX_SPEAK_CHARS + 1) }, TutorSpeakRequestDto))).toContain("text");
  });

  it("teks wajib, tidak kosong, dan harus string", async () => {
    expect(await messagesOf(validate({}, TutorSpeakRequestDto))).toContain("text");
    expect(await messagesOf(validate({ text: "" }, TutorSpeakRequestDto))).toContain("text");
    expect(await messagesOf(validate({ text: 42 }, TutorSpeakRequestDto))).toContain("text");
  });

  it("field tak dikenal ditolak", async () => {
    expect(await messagesOf(validate({ text: "こんにちは", voice: "onyx" }, TutorSpeakRequestDto))).toContain("voice");
  });
});
