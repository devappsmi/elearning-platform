import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeMediaRecorder, installFakeMedia } from "../test/fake-media";
import type { FakeMedia } from "../test/fake-media";
import { detectVoiceSupport, RECORDING_MAX_SECONDS, useVoiceRecorder } from "./use-voice-recorder";
import type { RecordingResult } from "./use-voice-recorder";

let media: FakeMedia;

beforeEach(() => {
  vi.useFakeTimers();
  media = installFakeMedia();
});

afterEach(() => {
  media.uninstall();
  vi.useRealTimers();
});

function setup(maxSeconds?: number) {
  const onFinish = vi.fn<(result: RecordingResult) => void>();
  const hook = renderHook(() => useVoiceRecorder({ onFinish, maxSeconds }));
  return { ...hook, onFinish };
}

async function startRecording(result: { current: ReturnType<typeof useVoiceRecorder> }) {
  let started = false;
  await act(async () => {
    started = await result.current.start();
  });
  return started;
}

describe("detectVoiceSupport", () => {
  it("didukung bila konteks aman dan getUserMedia + MediaRecorder ada", () => {
    expect(detectVoiceSupport()).toEqual({ supported: true });
  });

  it("alamat HTTP biasa (bukan konteks aman) = 'insecure', dibedakan dari browser lama", () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });

    expect(detectVoiceSupport()).toEqual({ supported: false, reason: "insecure" });
  });

  it("tanpa navigator.mediaDevices = 'unsupported'", () => {
    Reflect.deleteProperty(navigator, "mediaDevices");

    expect(detectVoiceSupport()).toEqual({ supported: false, reason: "unsupported" });
  });

  it("tanpa MediaRecorder = 'unsupported'", () => {
    vi.stubGlobal("MediaRecorder", undefined);

    expect(detectVoiceSupport()).toEqual({ supported: false, reason: "unsupported" });
  });
});

describe("useVoiceRecorder", () => {
  it("mulai: meminta mikrofon dengan penekan bising, memakai format yang didukung, status 'recording'", async () => {
    const { result } = setup();

    expect(await startRecording(result)).toBe(true);

    expect(media.getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    expect(result.current.status).toBe("recording");
    expect(media.recorders).toHaveLength(1);
    expect(media.recorders[0]!.mimeType).toBe("audio/webm;codecs=opus");
    expect(media.recorders[0]!.state).toBe("recording");
  });

  it("memilih format berikutnya bila webm/opus tidak didukung (mis. Safari: mp4)", async () => {
    FakeMediaRecorder.supportedTypes = ["audio/mp4"];
    const { result, onFinish } = setup();

    await startRecording(result);
    vi.advanceTimersByTime(1000);
    act(() => result.current.stop());

    expect(onFinish.mock.calls[0]![0].mimeType).toBe("audio/mp4");
  });

  it("tanpa format yang dikenal browser tetap merekam dengan format bawaan perekam", async () => {
    FakeMediaRecorder.supportedTypes = [];
    const { result, onFinish } = setup();

    await startRecording(result);
    vi.advanceTimersByTime(1000);
    act(() => result.current.stop());

    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish.mock.calls[0]![0].mimeType).toBe("audio/webm");
  });

  it("berhenti: menyerahkan rekaman (blob + format + durasi), melepas mikrofon, status kembali 'idle'", async () => {
    const { result, onFinish } = setup();
    await startRecording(result);

    vi.advanceTimersByTime(2500);
    act(() => result.current.stop());

    expect(onFinish).toHaveBeenCalledOnce();
    const recording = onFinish.mock.calls[0]![0];
    expect(recording.mimeType).toBe("audio/webm;codecs=opus");
    expect(recording.durationMs).toBeGreaterThanOrEqual(2500);
    expect(recording.blob.size).toBe(4000);
    expect(media.tracks[0]!.stop).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.elapsedMs).toBe(0);
  });

  it("menghitung waktu berjalan selama merekam", async () => {
    const { result } = setup();
    await startRecording(result);

    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(3000);
  });

  it("berhenti otomatis di batas durasi", async () => {
    const { result, onFinish } = setup(5);
    await startRecording(result);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onFinish).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("idle");
    expect(media.tracks[0]!.stop).toHaveBeenCalled();
  });

  it(`batas bawaan ${RECORDING_MAX_SECONDS} detik`, async () => {
    const { result, onFinish } = setup();
    await startRecording(result);

    act(() => {
      vi.advanceTimersByTime((RECORDING_MAX_SECONDS - 1) * 1000);
    });
    expect(onFinish).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("terlalu singkat (di bawah 0,4 detik): tidak diserahkan, error 'too-short'", async () => {
    const { result, onFinish } = setup();
    await startRecording(result);

    vi.advanceTimersByTime(100);
    act(() => result.current.stop());

    expect(onFinish).not.toHaveBeenCalled();
    expect(result.current.error).toBe("too-short");
    expect(result.current.status).toBe("idle");
    expect(media.tracks[0]!.stop).toHaveBeenCalled();
  });

  it("data nyaris kosong (di bawah 1 KB): tidak diserahkan, error 'too-short'", async () => {
    FakeMediaRecorder.bytes = 200;
    const { result, onFinish } = setup();
    await startRecording(result);

    vi.advanceTimersByTime(2000);
    act(() => result.current.stop());

    expect(onFinish).not.toHaveBeenCalled();
    expect(result.current.error).toBe("too-short");
  });

  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "no-device"],
    ["OverconstrainedError", "no-device"],
    ["AbortError", "failed"],
  ])("izin/perangkat gagal (%s) -> error '%s', status kembali 'idle', mikrofon tidak tertinggal", async (name, kind) => {
    media.failWith(name);
    const { result, onFinish } = setup();

    expect(await startRecording(result)).toBe(false);

    expect(result.current.error).toBe(kind);
    expect(result.current.status).toBe("idle");
    expect(onFinish).not.toHaveBeenCalled();
    expect(media.recorders).toHaveLength(0);
  });

  it("bisa mencoba lagi setelah ditolak, dan galat lama dibersihkan saat mulai", async () => {
    media.failWith("NotAllowedError");
    const { result } = setup();
    await startRecording(result);
    expect(result.current.error).toBe("denied");

    media.failWith(null);
    expect(await startRecording(result)).toBe(true);

    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("recording");
  });

  it("clearError menghapus galat", async () => {
    media.failWith("NotFoundError");
    const { result } = setup();
    await startRecording(result);

    act(() => result.current.clearError());

    expect(result.current.error).toBeNull();
  });

  it("ketukan ganda saat sedang merekam diabaikan (hanya satu perekam)", async () => {
    const { result } = setup();
    await startRecording(result);

    expect(await startRecording(result)).toBe(false);

    expect(media.recorders).toHaveLength(1);
    expect(media.getUserMedia).toHaveBeenCalledOnce();
  });

  it("batal: tidak menyerahkan hasil, mikrofon dilepas", async () => {
    const { result, onFinish } = setup();
    await startRecording(result);
    vi.advanceTimersByTime(2000);

    act(() => result.current.cancel());

    expect(onFinish).not.toHaveBeenCalled();
    expect(media.tracks[0]!.stop).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("halaman ditutup saat merekam: mikrofon dilepas dan tidak ada hasil yang diserahkan", async () => {
    const { result, unmount, onFinish } = setup();
    await startRecording(result);
    vi.advanceTimersByTime(2000);

    unmount();

    expect(media.tracks[0]!.stop).toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
    expect(media.recorders[0]!.state).toBe("inactive");
  });

  it("dihentikan selagi kotak izin masih terbuka: begitu izin turun, mikrofon langsung dilepas dan tidak merekam", async () => {
    const gate = media.hold();
    const { result, onFinish } = setup();

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.start();
    });
    expect(result.current.status).toBe("starting");
    act(() => result.current.stop());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      gate.release();
      expect(await pending).toBe(false);
    });

    expect(media.recorders).toHaveLength(0);
    expect(media.tracks[0]!.stop).toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("halaman ditutup selagi kotak izin terbuka: mikrofon yang baru diberikan dilepas", async () => {
    const gate = media.hold();
    const { result, unmount } = setup();
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.start();
    });

    unmount();
    gate.release();
    await act(async () => {
      expect(await pending).toBe(false);
    });

    expect(media.recorders).toHaveLength(0);
    expect(media.tracks[0]!.stop).toHaveBeenCalled();
  });

  it("perekam error di tengah jalan: berhenti, error 'failed', tidak ada hasil", async () => {
    const { result, onFinish } = setup();
    await startRecording(result);

    act(() => {
      media.recorders[0]!.onerror?.();
    });

    expect(onFinish).not.toHaveBeenCalled();
    expect(result.current.error).toBe("failed");
    expect(result.current.status).toBe("idle");
    expect(media.tracks[0]!.stop).toHaveBeenCalled();
  });

  it("tidak mendukung: start() mengembalikan false tanpa menyentuh mikrofon", async () => {
    Reflect.deleteProperty(navigator, "mediaDevices");
    const { result } = setup();

    expect(result.current.support).toEqual({ supported: false, reason: "unsupported" });
    expect(await startRecording(result)).toBe(false);
    expect(result.current.status).toBe("idle");
  });
});
