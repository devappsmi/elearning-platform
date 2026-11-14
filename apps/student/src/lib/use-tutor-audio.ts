import { useCallback, useEffect, useRef, useState } from "react";

/** Pemutar suara balasan AI: SATU elemen <audio> dipakai ulang untuk semua balasan (memulai yang baru menghentikan yang lama,
 * dan merekam menghentikan suara supaya tidak terdengar masuk ke mikrofon). */

/** WAV tanpa isi. Dimainkan senyap sekali di dalam ketukan murid untuk "membuka kunci" elemen: iOS Safari hanya mengizinkan
 * play() di dalam ketukan, tetapi elemen yang sudah terbuka boleh memutar suara balasan yang datang beberapa detik kemudian. */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/** `blocked`: browser menolak putar otomatis (belum ada ketukan); `interrupted`: digantikan suara lain; `failed`: berkas tak bisa diputar. */
export type PlayResult = "played" | "blocked" | "interrupted" | "failed";

function errorName(error: unknown): string {
  return typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
}

export function useTutorAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentIdRef = useRef<number | null>(null);
  const unlockedRef = useRef(false);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const element = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      // "Sedang diputar" dibaca dari elemennya sendiri: peristiwa `pause` milik suara lama bisa tiba SESUDAH suara baru dimulai.
      const sync = () => setPlayingId(audio.paused || audio.error ? null : currentIdRef.current);
      audio.addEventListener("ended", sync);
      audio.addEventListener("pause", sync);
      audio.addEventListener("error", sync);
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const play = useCallback(
    async (id: number, url: string): Promise<PlayResult> => {
      const audio = element();
      currentIdRef.current = id;
      try {
        audio.pause();
        audio.muted = false;
        audio.src = url;
        setPlayingId(id);
        await audio.play();
        return "played";
      } catch (error) {
        if (currentIdRef.current === id) setPlayingId(null);
        const name = errorName(error);
        if (name === "NotAllowedError") return "blocked";
        if (name === "AbortError") return "interrupted";
        return "failed";
      }
    },
    [element],
  );

  const stop = useCallback(() => {
    currentIdRef.current = null;
    audioRef.current?.pause();
    setPlayingId(null);
  }, []);

  /** Panggil LANGSUNG di dalam penangan ketukan (mulai ngobrol, rekam, kirim). Aman dipanggil berkali-kali: hanya yang pertama bekerja. */
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    const audio = element();
    try {
      audio.muted = true;
      audio.src = SILENT_WAV;
      Promise.resolve(audio.play())
        .then(() => {
          audio.pause();
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
          unlockedRef.current = false;
        });
    } catch {
      audio.muted = false;
      unlockedRef.current = false;
    }
  }, [element]);

  useEffect(
    () => () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
    },
    [],
  );

  return { play, stop, unlock, playingId };
}
