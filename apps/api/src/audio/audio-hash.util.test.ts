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
});
