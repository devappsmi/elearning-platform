import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { AudioService } from "./audio.service";
import { TtsClient } from "./tts-client";
import type { ObjectStorageService } from "./object-storage.service";
import { hashAudioKey } from "./audio-hash.util";

function fakePrisma(existing: { s3Url: string } | null) {
  return {
    audioAsset: {
      findUnique: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({ ...create, id: "new" })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as PrismaClient;
}

function fakeTts(): TtsClient {
  return { synthesize: vi.fn().mockResolvedValue(Buffer.from("fake-mp3-bytes")) };
}

function fakeStorage(): ObjectStorageService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { upload: vi.fn().mockResolvedValue("http://fake-s3/audio/abc.mp3") } as any as ObjectStorageService;
}

describe("AudioService.resolveAudioUrl", () => {
  it("cache hit: returns stored s3Url and NEVER calls the TTS provider or storage", async () => {
    const prisma = fakePrisma({ s3Url: "http://fake-s3/audio/existing.mp3" });
    const tts = fakeTts();
    const storage = fakeStorage();
    const service = new AudioService(prisma, tts, storage);

    const url = await service.resolveAudioUrl("あ", "female");

    expect(url).toBe("http://fake-s3/audio/existing.mp3");
    expect(tts.synthesize).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("cache miss: generates, uploads, and persists a new AudioAsset", async () => {
    const prisma = fakePrisma(null);
    const tts = fakeTts();
    const storage = fakeStorage();
    const service = new AudioService(prisma, tts, storage);

    const url = await service.resolveAudioUrl("あ", "female");

    expect(tts.synthesize).toHaveBeenCalledWith("あ", "female");
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(prisma.audioAsset.upsert).toHaveBeenCalledTimes(1);
    expect(url).toBe("http://fake-s3/audio/abc.mp3");
  });

  it("looks up by hash(text + voice), so the same text with a different voice is a separate cache entry", async () => {
    const prisma = fakePrisma(null);
    const service = new AudioService(prisma, fakeTts(), fakeStorage());

    await service.resolveAudioUrl("あ", "male");

    expect(prisma.audioAsset.findUnique).toHaveBeenCalledWith({ where: { textHash: hashAudioKey("あ", "male") } });
  });
});
