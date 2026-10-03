/** Contoh suara TTS pelajaran -- dengarkan SEBELUM `db:seed` membuat ~160 audio sekaligus.
 *
 *   pnpm run tts:sample
 *   (Docker: docker compose run --rm tools pnpm run tts:sample)
 *
 * Memakai penyedia dan suara yang sama dengan seed (TTS_PROVIDER, OPENAI_LESSON_TTS_VOICE_*, AZURE_*, ...), menyimpan
 * beberapa contoh ke folder `samples/` di penyimpanan audio (TIDAK menyentuh database), lalu mencetak alamatnya untuk
 * dibuka di browser. Suara kurang cocok? Ubah suaranya di .env dan jalankan lagi. Kode keluar 1 bila gagal
 * (kredensial belum diisi/ditolak, penyimpanan tak bisa ditulis). */
import { createAudioStorage } from "../src/audio/audio-storage";
import { resolveStorageOptions } from "../src/audio/storage-options";
import { createTtsClient } from "../src/audio/tts-factory";
import { resolveTtsOptions } from "../src/audio/tts-options";
import { runTtsSamples } from "../src/audio/tts-sample";

// Seperti `prisma db seed`, baca .env bila ada (di Docker environment datang dari compose dan berkas .env tidak ada
// di image). Nilai yang sudah ada di environment tidak ditimpa.
try {
  process.loadEnvFile();
} catch {
  // tidak ada .env: pakai environment apa adanya
}

async function main(): Promise<void> {
  const options = resolveTtsOptions(process.env);
  const tts = createTtsClient(options);
  const storage = createAudioStorage(resolveStorageOptions(process.env));

  const result = await runTtsSamples(options, tts, storage, (line) => console.log(line));
  if (result.failure) {
    process.exitCode = 1;
    return;
  }
  console.log(
    `\nSelesai: ${result.saved}/${result.total} contoh. Buka tautan di atas di browser dan dengarkan (server API/stack harus ` +
      "berjalan agar /media tersaji). Tidak cocok? Ganti suara di .env (mis. OPENAI_LESSON_TTS_VOICE_FEMALE=coral) lalu jalankan lagi.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `GAGAL: ${error.message}` : error);
  process.exitCode = 1;
});
