import { describe, expect, it } from "vitest";
import { MAX_TUTOR_AUDIO_BYTES, audioFilenameFor, normalizeMime } from "./tutor-audio.util";

describe("normalizeMime", () => {
  it("membuang parameter codec yang ditempel MediaRecorder", () => {
    expect(normalizeMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeMime("audio/ogg; codecs=opus")).toBe("audio/ogg");
  });

  it("huruf kecil dan tanpa spasi tepi", () => {
    expect(normalizeMime("  Audio/WAV ")).toBe("audio/wav");
  });

  it("string kosong tetap kosong", () => {
    expect(normalizeMime("")).toBe("");
  });
});

describe("audioFilenameFor", () => {
  it.each([
    ["audio/webm", "recording.webm"],
    ["audio/webm;codecs=opus", "recording.webm"],
    ["video/webm", "recording.webm"], // Chrome kadang melabeli rekaman audio-saja sebagai video/webm
    ["audio/ogg", "recording.ogg"],
    ["audio/mp4", "recording.mp4"], // Safari
    ["audio/x-m4a", "recording.m4a"],
    ["audio/mpeg", "recording.mp3"],
    ["audio/wav", "recording.wav"],
    ["audio/x-wav", "recording.wav"],
    ["audio/flac", "recording.flac"],
  ])("%s -> %s", (mime, expected) => {
    expect(audioFilenameFor(mime)).toBe(expected);
  });

  it.each(["application/pdf", "text/plain", "image/png", "application/octet-stream", ""])(
    "format tidak didukung (%j) -> undefined",
    (mime) => {
      expect(audioFilenameFor(mime)).toBeUndefined();
    },
  );
});

describe("MAX_TUTOR_AUDIO_BYTES", () => {
  it("10 MiB -- jauh di bawah batas 25 MB OpenAI, cukup untuk ucapan latihan", () => {
    expect(MAX_TUTOR_AUDIO_BYTES).toBe(10 * 1024 * 1024);
  });
});
