import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTutorAudio } from "./use-tutor-audio";

const URL_A = "http://localhost/media/a.mp3";
const URL_B = "http://localhost/media/b.mp3";

let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;

function rejection(name: string): Error {
  return Object.assign(new Error(name), { name });
}

/** Elemen <audio> yang dipakai hook (satu-satunya yang dibuat), dari konteks panggilan play() pertama. */
function audioElement(): HTMLAudioElement {
  return play.mock.contexts[0] as HTMLAudioElement;
}

beforeEach(() => {
  // jsdom tidak mengimplementasikan pemutaran media.
  play = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  pause = vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup(); // lepas hook (menjeda audio) SEBELUM spy dikembalikan, supaya pause() asli jsdom tidak terpanggil
  vi.restoreAllMocks();
});

describe("useTutorAudio", () => {
  it("memutar alamat yang diberikan dan menandai id yang sedang diputar", async () => {
    const { result } = renderHook(() => useTutorAudio());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.play(1, URL_A);
    });

    expect(outcome).toBe("played");
    expect(audioElement().src).toBe(URL_A);
    expect(result.current.playingId).toBe(1);
  });

  it("selesai diputar (peristiwa ended) -> tidak ada yang sedang diputar", async () => {
    const { result } = renderHook(() => useTutorAudio());
    await act(async () => {
      await result.current.play(1, URL_A);
    });

    act(() => {
      audioElement().dispatchEvent(new Event("ended"));
    });

    expect(result.current.playingId).toBeNull();
  });

  it("peristiwa pause milik suara LAMA tidak menghapus penanda suara baru yang sudah berjalan", async () => {
    const { result } = renderHook(() => useTutorAudio());
    await act(async () => {
      await result.current.play(1, URL_A);
    });
    await act(async () => {
      await result.current.play(2, URL_B);
    });
    // Elemen sungguhan melaporkan paused=false selagi suara kedua diputar.
    Object.defineProperty(audioElement(), "paused", { value: false, configurable: true });

    act(() => {
      audioElement().dispatchEvent(new Event("pause")); // tiba terlambat dari suara pertama
    });

    expect(result.current.playingId).toBe(2);
    expect(audioElement().src).toBe(URL_B);
  });

  it("memulai suara baru menghentikan yang lama lebih dulu", async () => {
    const { result } = renderHook(() => useTutorAudio());
    await act(async () => {
      await result.current.play(1, URL_A);
    });
    pause.mockClear();

    await act(async () => {
      await result.current.play(2, URL_B);
    });

    expect(pause).toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("browser menolak putar otomatis (NotAllowedError) -> 'blocked', tidak ada yang ditandai diputar", async () => {
    play.mockRejectedValueOnce(rejection("NotAllowedError"));
    const { result } = renderHook(() => useTutorAudio());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.play(1, URL_A);
    });

    expect(outcome).toBe("blocked");
    expect(result.current.playingId).toBeNull();
  });

  it("digantikan suara lain (AbortError) -> 'interrupted'", async () => {
    play.mockRejectedValueOnce(rejection("AbortError"));
    const { result } = renderHook(() => useTutorAudio());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.play(1, URL_A);
    });

    expect(outcome).toBe("interrupted");
  });

  it("berkas tak bisa diputar (NotSupportedError) -> 'failed'", async () => {
    play.mockRejectedValueOnce(rejection("NotSupportedError"));
    const { result } = renderHook(() => useTutorAudio());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.play(1, URL_A);
    });

    expect(outcome).toBe("failed");
    expect(result.current.playingId).toBeNull();
  });

  it("stop menjeda dan menghapus penanda", async () => {
    const { result } = renderHook(() => useTutorAudio());
    await act(async () => {
      await result.current.play(1, URL_A);
    });
    pause.mockClear();

    act(() => result.current.stop());

    expect(pause).toHaveBeenCalled();
    expect(result.current.playingId).toBeNull();
  });

  it("stop tanpa pernah memutar tidak error", () => {
    const { result } = renderHook(() => useTutorAudio());

    expect(() => act(() => result.current.stop())).not.toThrow();
  });

  describe("unlock", () => {
    it("memainkan WAV senyap (dibisukan) sekali untuk membuka kunci elemen, lalu menjeda dan mengembalikan suara", async () => {
      const { result } = renderHook(() => useTutorAudio());

      await act(async () => {
        result.current.unlock();
      });

      expect(play).toHaveBeenCalledOnce();
      const audio = audioElement();
      expect(audio.src.startsWith("data:audio/wav;base64,")).toBe(true);
      expect(pause).toHaveBeenCalled();
      expect(audio.muted).toBe(false);
    });

    it("panggilan berikutnya tidak melakukan apa-apa", async () => {
      const { result } = renderHook(() => useTutorAudio());

      await act(async () => {
        result.current.unlock();
      });
      await act(async () => {
        result.current.unlock();
        result.current.unlock();
      });

      expect(play).toHaveBeenCalledOnce();
    });

    it("gagal (ditolak browser): suara dikembalikan tidak bisu dan percobaan berikutnya boleh mengulang", async () => {
      play.mockRejectedValueOnce(rejection("NotAllowedError"));
      const { result } = renderHook(() => useTutorAudio());

      await act(async () => {
        result.current.unlock();
      });
      expect(audioElement().muted).toBe(false);

      await act(async () => {
        result.current.unlock();
      });
      expect(play).toHaveBeenCalledTimes(2);
    });

    it("pemutaran sungguhan sesudah unlock memakai suara hidup (tidak bisu)", async () => {
      const { result } = renderHook(() => useTutorAudio());
      await act(async () => {
        result.current.unlock();
      });
      audioElement().muted = true; // seandainya sisa dari kunci belum dipulihkan

      await act(async () => {
        await result.current.play(7, URL_A);
      });

      expect(audioElement().muted).toBe(false);
      expect(audioElement().src).toBe(URL_A);
    });
  });

  it("ditutup: suara dijeda dan sumbernya dilepas", async () => {
    const { result, unmount } = renderHook(() => useTutorAudio());
    await act(async () => {
      await result.current.play(1, URL_A);
    });
    const audio = audioElement();
    pause.mockClear();

    unmount();

    expect(pause).toHaveBeenCalled();
    expect(audio.getAttribute("src")).toBeNull();
  });
});
