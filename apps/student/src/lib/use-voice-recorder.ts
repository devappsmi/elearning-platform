import { useCallback, useEffect, useRef, useState } from "react";

/** Perekam suara untuk layar "Ngobrol dengan AI": MediaRecorder di atas getUserMedia. Tekan sekali untuk mulai, sekali lagi untuk
 * berhenti (bukan tahan-untuk-bicara, supaya bisa dipakai tanpa menahan jari dan dengan pembaca layar). Hasilnya (Blob) diserahkan
 * lewat `onFinish`; rekaman yang dibatalkan atau terlalu singkat tidak diserahkan. */

export const RECORDING_MAX_SECONDS = 30;
/** Rekaman di bawah ambang ini dianggap kosong (salah pencet): tidak dikirim ke transkripsi berbayar. */
const MIN_RECORDING_MS = 400;
const MIN_RECORDING_BYTES = 1000;
/** Urutan pilihan format: webm/opus (Chrome, Edge, Firefox sebagian), mp4 (Safari), ogg (Firefox). Server menerima semuanya. */
const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export type VoiceSupport = { supported: true } | { supported: false; reason: "insecure" | "unsupported" };

/** `getUserMedia` hanya ada di konteks aman (HTTPS atau localhost): lewat HTTP biasa `navigator.mediaDevices` tidak ada. */
export function detectVoiceSupport(): VoiceSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") return { supported: false, reason: "unsupported" };
  if (window.isSecureContext === false) return { supported: false, reason: "insecure" };
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function" || typeof MediaRecorder === "undefined") {
    return { supported: false, reason: "unsupported" };
  }
  return { supported: true };
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export type RecorderStatus = "idle" | "starting" | "recording";
export type RecorderErrorKind = "denied" | "no-device" | "failed" | "too-short";

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

function mediaErrorKind(error: unknown): RecorderErrorKind {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "no-device";
  return "failed";
}

function stopTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export interface UseVoiceRecorderOptions {
  maxSeconds?: number;
  /** Dipanggil saat rekaman selesai (berhenti manual atau mencapai batas durasi) dan cukup panjang. */
  onFinish: (result: RecordingResult) => void;
}

export function useVoiceRecorder({ maxSeconds = RECORDING_MAX_SECONDS, onFinish }: UseVoiceRecorderOptions) {
  const [support] = useState(detectVoiceSupport);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<RecorderErrorKind | null>(null);

  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const mountedRef = useRef(true);
  const busyRef = useRef(false); // true sejak start() dipanggil sampai rekaman selesai: menolak ketukan ganda
  const attemptRef = useRef(0); // naik tiap start/cancel: start yang sudah "basi" (dibatalkan saat menunggu izin) berhenti sendiri
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const limitRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimers = useCallback(() => {
    clearInterval(tickRef.current);
    clearTimeout(limitRef.current);
    tickRef.current = undefined;
    limitRef.current = undefined;
  }, []);

  const finalize = useCallback(
    (mimeType: string) => {
      clearTimers();
      stopTracks(streamRef.current);
      streamRef.current = null;
      recorderRef.current = null;
      busyRef.current = false;

      const durationMs = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      if (mountedRef.current) {
        setStatus("idle");
        setElapsedMs(0);
      }
      if (cancelledRef.current) return;
      if (durationMs < MIN_RECORDING_MS || blob.size < MIN_RECORDING_BYTES) {
        if (mountedRef.current) setError("too-short");
        return;
      }
      onFinishRef.current({ blob, mimeType, durationMs });
    },
    [clearTimers],
  );

  const start = useCallback(async (): Promise<boolean> => {
    if (!support.supported || busyRef.current) return false;
    busyRef.current = true;
    const attempt = ++attemptRef.current;
    cancelledRef.current = false;
    setError(null);
    setStatus("starting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (caught) {
      if (attempt === attemptRef.current) {
        busyRef.current = false;
        if (mountedRef.current) {
          setStatus("idle");
          setError(mediaErrorKind(caught));
        }
      }
      return false;
    }
    if (attempt !== attemptRef.current || !mountedRef.current) {
      // Dibatalkan (atau halaman ditutup) selagi kotak izin terbuka: lepaskan mikrofon yang baru saja diberikan.
      stopTracks(stream);
      return false;
    }

    let recorder: MediaRecorder;
    const wantedType = pickMimeType();
    try {
      recorder = new MediaRecorder(stream, wantedType ? { mimeType: wantedType } : undefined);
    } catch {
      stopTracks(stream);
      busyRef.current = false;
      setStatus("idle");
      setError("failed");
      return false;
    }

    chunksRef.current = [];
    streamRef.current = stream;
    recorderRef.current = recorder;
    const mimeType = recorder.mimeType || wantedType || "audio/webm";
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => finalize(mimeType);
    recorder.onerror = () => {
      cancelledRef.current = true;
      if (mountedRef.current) setError("failed");
      if (recorder.state !== "inactive") recorder.stop();
      else finalize(mimeType);
    };

    startedAtRef.current = Date.now();
    recorder.start();
    setElapsedMs(0);
    setStatus("recording");
    tickRef.current = setInterval(() => {
      if (mountedRef.current) setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
    limitRef.current = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, maxSeconds * 1000);
    return true;
  }, [support.supported, maxSeconds, finalize]);

  /** Berhenti dan serahkan hasilnya lewat `onFinish`. Saat masih menunggu izin mikrofon, ini membatalkan permulaan. */
  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }
    if (busyRef.current && !recorder) {
      attemptRef.current++;
      busyRef.current = false;
      setStatus("idle");
    }
  }, []);

  /** Berhenti tanpa menyerahkan hasil (mis. murid pindah halaman atau memulai ulang). */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }
    if (busyRef.current) {
      attemptRef.current++;
      busyRef.current = false;
      clearTimers();
      stopTracks(streamRef.current);
      streamRef.current = null;
      recorderRef.current = null;
      if (mountedRef.current) setStatus("idle");
    }
  }, [clearTimers]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancel();
      clearTimers();
    };
  }, [cancel, clearTimers]);

  return { support, status, elapsedMs, error, clearError, start, stop, cancel };
}
