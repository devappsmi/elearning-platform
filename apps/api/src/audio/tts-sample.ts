import type { AudioVoice } from "./audio-hash.util";
import type { AudioStorage } from "./audio-storage";
import type { TtsClient } from "./tts-client";
import { describeTtsOptions, ttsFingerprint, type TtsOptions } from "./tts-options";

/** Contoh suara untuk didengarkan SEBELUM `db:seed` membuat ~160 audio sekaligus (prisma/tts-sample.ts). Dipilih dari
 * jenis teks yang benar-benar ada di konten (huruf kana tunggal, bunyi gabungan, kata kanji) plus kasus yang paling
 * sering salah dibaca mesin TTS: は/を dibaca terpisah dari kalimatnya, dan kanji dengan bacaan khusus. */
export interface TtsSample {
  text: string;
  voice: AudioVoice;
  /** Apa yang perlu didengar -- tampil di layar bersama tautannya. */
  note: string;
}

export const TTS_SAMPLES: readonly TtsSample[] = [
  { text: "あ", voice: "female", note: "huruf kana tunggal, dibaca \"a\"" },
  { text: "は", voice: "female", note: "harus \"ha\" (bukan partikel \"wa\")" },
  { text: "を", voice: "female", note: "harus \"o\"" },
  { text: "しゃ", voice: "female", note: "bunyi gabungan, satu ketukan \"sha\"" },
  { text: "愛", voice: "female", note: "kanji tunggal, harus \"ai\" (あい)" },
  { text: "今日", voice: "female", note: "bacaan khusus, harus \"kyou\" (きょう)" },
  { text: "お母さん", voice: "female", note: "kata majemuk, harus \"okaasan\" (おかあさん)" },
  { text: "あ", voice: "male", note: "suara laki-laki" },
  { text: "今日", voice: "male", note: "suara laki-laki" },
];

export interface TtsSampleResult {
  total: number;
  saved: number;
  /** Ada bila berhenti karena kegagalan (klien belum dikonfigurasi, kunci ditolak, penyimpanan tak bisa ditulis). */
  failure?: { text: string; message: string };
}

/** Membuat tiap contoh lewat klien TTS, menyimpannya di `samples/` pada penyimpanan audio (TANPA menyentuh database,
 * jadi tidak mengisi cache audio pelajaran), dan mencatat alamat publiknya lewat `log`. Berhenti di kegagalan pertama.
 * Klien yang belum dikonfigurasi gagal di contoh pertama dengan pesannya sendiri yang menyebut apa yang kurang --
 * tanpa panggilan jaringan. */
export async function runTtsSamples(
  options: TtsOptions,
  tts: TtsClient,
  storage: AudioStorage,
  log: (line: string) => void,
): Promise<TtsSampleResult> {
  const fingerprint = ttsFingerprint(options);
  log(`Contoh suara TTS pelajaran -- penyedia: ${describeTtsOptions(options)}`);

  let saved = 0;
  for (const [index, sample] of TTS_SAMPLES.entries()) {
    const label = `[${index + 1}/${TTS_SAMPLES.length}] ${sample.text} (${sample.voice === "male" ? "laki-laki" : "perempuan"}) -- ${sample.note}`;
    try {
      const audio = await tts.synthesize(sample.text, sample.voice);
      // Sidik setelan di nama berkas: ganti suara/instruksi = berkas baru, bukan contoh lama dari cache browser.
      const key = `samples/tts-${options.provider}-${fingerprint}-${String(index + 1).padStart(2, "0")}-${sample.voice}.mp3`;
      const url = await storage.upload(key, audio, "audio/mpeg");
      log(label);
      log(`      ${url}`);
      saved++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`${label}\n      GAGAL: ${message}`);
      return { total: TTS_SAMPLES.length, saved, failure: { text: sample.text, message } };
    }
  }
  return { total: TTS_SAMPLES.length, saved };
}
