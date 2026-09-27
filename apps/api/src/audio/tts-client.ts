import type { AudioVoice } from "./audio-hash.util";

/** Seam TTS -- abstract class dipakai sebagai token DI NestJS (pola sama
 * dengan REDIS_CLIENT), supaya AudioService bisa dites dengan implementasi
 * palsu tanpa memanggil provider sungguhan/butuh kredensial. Implementasi
 * sungguhan: AzureTtsClient. */
export abstract class TtsClient {
  abstract synthesize(textJp: string, voice: AudioVoice): Promise<Buffer>;
}
