import { vi } from "vitest";

/** Mikrofon dan MediaRecorder tiruan untuk tes (jsdom tidak punya keduanya). `stop()` pada perekam menghasilkan satu
 * potongan data lalu memanggil `onstop`, seperti browser. Pasang di awal tes, panggil `uninstall()` di akhir. */

export interface FakeTrack {
  stop: ReturnType<typeof vi.fn>;
}

export class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static supportedTypes = ["audio/webm;codecs=opus", "audio/webm"];
  /** Ukuran data rekaman yang dihasilkan `stop()` (bawaan cukup besar agar lolos batas "terlalu singkat"). */
  static bytes = 4000;
  static isTypeSupported = (type: string) => FakeMediaRecorder.supportedTypes.includes(type);

  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(
    readonly stream: MediaStream,
    options?: { mimeType?: string },
  ) {
    this.mimeType = options?.mimeType ?? "";
    FakeMediaRecorder.instances.push(this);
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array(FakeMediaRecorder.bytes)], { type: this.mimeType }) });
    this.onstop?.();
  }
}

export interface FakeMedia {
  getUserMedia: ReturnType<typeof vi.fn>;
  tracks: FakeTrack[];
  recorders: FakeMediaRecorder[];
  /** Permintaan izin berikutnya gagal dengan galat bernama `name` (mis. "NotAllowedError"); `null` = berhasil lagi. */
  failWith: (name: string | null) => void;
  /** Permintaan izin berikutnya menggantung sampai `release()` dipanggil (kotak izin browser yang masih terbuka). */
  hold: () => { release: () => void };
  uninstall: () => void;
}

export function installFakeMedia(): FakeMedia {
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.bytes = 4000;
  FakeMediaRecorder.supportedTypes = ["audio/webm;codecs=opus", "audio/webm"];
  const tracks: FakeTrack[] = [];
  let errorName: string | null = null;
  let gate: Promise<void> | null = null;

  const getUserMedia = vi.fn(async () => {
    if (gate) await gate;
    if (errorName) throw Object.assign(new Error(errorName), { name: errorName });
    const track: FakeTrack = { stop: vi.fn() };
    tracks.push(track);
    return { getTracks: () => [track] } as unknown as MediaStream;
  });

  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

  return {
    getUserMedia,
    tracks,
    recorders: FakeMediaRecorder.instances,
    failWith: (name) => {
      errorName = name;
    },
    hold: () => {
      let release = () => {};
      gate = new Promise<void>((resolve) => {
        release = () => {
          gate = null;
          resolve();
        };
      });
      return { release };
    },
    uninstall: () => {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, "mediaDevices");
      Reflect.deleteProperty(window, "isSecureContext");
    },
  };
}
