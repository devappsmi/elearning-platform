import { describe, expect, it } from "vitest";
import { hashAudioKey } from "./audio-hash.util";

describe("hashAudioKey", () => {
  it("is deterministic", () => {
    expect(hashAudioKey("あ", "female")).toBe(hashAudioKey("あ", "female"));
  });

  it("differs by voice, not just text", () => {
    expect(hashAudioKey("あ", "female")).not.toBe(hashAudioKey("あ", "male"));
  });

  it("differs by text, not just voice", () => {
    expect(hashAudioKey("あ", "female")).not.toBe(hashAudioKey("い", "female"));
  });

  it("produces a hex sha256 digest", () => {
    expect(hashAudioKey("あ", "female")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accepts a free-form voice key (TutorModule) without colliding with 'female'/'male'", () => {
    const tutor = hashAudioKey("あ", "openai:gpt-4o-mini-tts:nova:1a2b3c4d");
    expect(tutor).toMatch(/^[0-9a-f]{64}$/);
    expect(tutor).not.toBe(hashAudioKey("あ", "female"));
    expect(tutor).not.toBe(hashAudioKey("あ", "male"));
  });

  it("keeps the exact digests already stored for 'female'/'male' (no orphaned audio after widening the type)", () => {
    // Digest asli sha256("あ|female") / sha256("あ|male"), di-pin literal:
    // kalau rumus kunci berubah (mis. separator), SELURUH audio konten yang
    // sudah di-cache jadi yatim tanpa ada error apa pun -- test ini yang
    // menangkapnya, bukan runtime.
    expect(hashAudioKey("あ", "female")).toBe("98afba906965d7489100f4790257ba1f6c499efe6c7b8f4b1cb83d16fc94e7bb");
    expect(hashAudioKey("あ", "male")).toBe("d4cc6bfb3c79c2eec97a151d7f8c46a70b7e3ac138e3f23bc867f0ce4060711f");
  });
});
