import type { AudioVoice } from "./audio-hash.util";
import type { AudioService } from "./audio.service";

/** Pembuatan audio pelajaran saat seed (prisma/seed.ts) -- dipisah dari skrip supaya perilakunya bisa dites tanpa
 * database maupun penyedia TTS sungguhan. */

export interface LessonAudioItem {
  text: string;
  voice: AudioVoice;
}

/** Teks konten yang perlu audio: tiap kosakata (suara perempuan) dan tiap kalimat (suara sesuai kalimat). Pasangan
 * (teks, suara) yang sama hanya sekali -- penting untuk mode `refresh`, yang tidak punya cache untuk menahan duplikat
 * (dan setiap duplikat berarti satu panggilan TTS berbayar). */
export function lessonAudioItems(unit: {
  vocab: readonly { surface: string }[];
  sentences: readonly { surface: string; voice?: string }[];
}): LessonAudioItem[] {
  const seen = new Set<string>();
  const items: LessonAudioItem[] = [];
  const add = (text: string, voice: AudioVoice): void => {
    const key = `${voice}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ text, voice });
  };
  for (const v of unit.vocab) add(v.surface, "female");
  for (const s of unit.sentences) add(s.surface, s.voice === "male" ? "male" : "female");
  return items;
}

/** `lessonAudioItems` untuk beberapa unit sekaligus, di-dedupe LINTAS unit (teks + suara yang sama di dua unit hanya sekali). */
export function lessonAudioItemsForUnits(units: readonly Parameters<typeof lessonAudioItems>[0][]): LessonAudioItem[] {
  const seen = new Set<string>();
  const items: LessonAudioItem[] = [];
  for (const unit of units) {
    for (const item of lessonAudioItems(unit)) {
      const key = `${item.voice}|${item.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}

export interface LessonAudioResult {
  total: number;
  /** Teks yang audionya siap (baru dibuat atau sudah ada di cache) sebelum selesai/berhenti. */
  ready: number;
  /** Ada bila berhenti karena kegagalan: teks yang gagal beserta pesannya. */
  failure?: { text: string; message: string };
}

/** Membuat audio tiap item lewat AudioService (cache-by-hash: yang sudah ada tidak memanggil TTS lagi), BERURUTAN.
 * Berhenti di kegagalan PERTAMA (bukan mengulang semua item) -- kegagalan TTS/penyimpanan di sini nyaris selalu
 * sistemik (kredensial salah, kuota habis, penyimpanan tidak terjangkau), dan mengulang 160 kali untuk galat yang
 * sama cuma menuh-menuhi log dan menghabiskan kuota. Tidak pernah melempar: kegagalan dilaporkan lewat `failure`.
 *
 * `refresh`: buat ulang SEMUA audio walau sudah ada (ganti suara/penyedia). Aman terhadap kegagalan di tengah jalan --
 * lihat AudioService.resolveAudioUrlWith. */
export async function seedLessonAudio(
  audio: Pick<AudioService, "resolveAudioUrl">,
  items: readonly LessonAudioItem[],
  options: { refresh?: boolean; onProgress?: (ready: number, total: number) => void } = {},
): Promise<LessonAudioResult> {
  let ready = 0;
  for (const item of items) {
    try {
      await audio.resolveAudioUrl(item.text, item.voice, { refresh: options.refresh });
    } catch (error) {
      return { total: items.length, ready, failure: { text: item.text, message: error instanceof Error ? error.message : String(error) } };
    }
    ready++;
    options.onProgress?.(ready, items.length);
  }
  return { total: items.length, ready };
}
