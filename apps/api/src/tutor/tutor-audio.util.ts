/** Batas ukuran rekaman untuk `/tutor/transcribe`. Ucapan latihan cuma
 * beberapa detik (webm/opus ~0,5 MB/menit, wav 16 kHz mono ~2 MB/menit);
 * batas OpenAI sendiri 25 MB -- 10 MB lebih dari cukup dan menahan upload
 * sembarangan sebelum sempat jadi panggilan API berbayar. */
export const MAX_TUTOR_AUDIO_BYTES = 10 * 1024 * 1024;

// Format yang diterima transkripsi OpenAI (flac, mp3, mp4, mpeg, mpga, m4a,
// ogg, wav, webm) yang realistis dihasilkan MediaRecorder browser:
// Chrome/Firefox -> webm/ogg, Safari -> mp4. Kunci = MIME ter-normalisasi.
const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

/** "audio/webm;codecs=opus" -> "audio/webm". MediaRecorder menempelkan
 * parameter codec di Content-Type bagian multipart. */
export function normalizeMime(mimetype: string): string {
  return (mimetype.split(";")[0] ?? "").trim().toLowerCase();
}

/** Nama file sintetis dengan ekstensi yang benar (OpenAI menebak format dari
 * ekstensi, dan blob dari browser sering tanpa nama). `undefined` = format
 * tidak didukung. Nama yang dikirim client sengaja TIDAK dipakai. */
export function audioFilenameFor(mimetype: string): string | undefined {
  const ext = AUDIO_EXTENSION_BY_MIME[normalizeMime(mimetype)];
  return ext ? `recording.${ext}` : undefined;
}
