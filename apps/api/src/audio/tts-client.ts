import type { AudioVoice } from "./audio-hash.util";

/** Seam TTS untuk audio PELAJARAN (kosakata/kalimat) -- abstract class dipakai sebagai token DI NestJS (pola sama
 * dengan REDIS_CLIENT), supaya AudioService bisa dites dengan implementasi palsu tanpa memanggil penyedia sungguhan/
 * butuh kredensial. Implementasi: AzureTtsClient, OpenAiTtsClient, dan UnavailableTtsClient (tts-factory.ts); yang
 * dipakai dipilih lewat TTS_PROVIDER (tts-options.ts). AI tutor punya seam sendiri (TutorTtsClient). */
export abstract class TtsClient {
  /** false = kredensial belum lengkap atau penyedia dimatikan: `synthesize` PASTI menolak (dengan pesan yang menyebut
   * apa yang kurang). Seed memakainya untuk melewati pembuatan audio tanpa memanggil apa pun. */
  abstract readonly configured: boolean;
  abstract synthesize(textJp: string, voice: AudioVoice): Promise<Buffer>;
}
