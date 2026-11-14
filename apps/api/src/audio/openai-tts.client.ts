import OpenAI from "openai";
import { TtsClient } from "./tts-client";
import type { AudioVoice } from "./audio-hash.util";

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;

/** TTS audio PELAJARAN lewat OpenAI (`audio.speech`) -- alternatif Azure untuk yang belum punya kunci Azure, memakai
 * kunci OpenAI yang sama dengan AI tutor. Dipilih lewat TTS_PROVIDER (lihat tts-options.ts).
 *
 * Sengaja berdiri sendiri, TIDAK memakai OpenAiTutorTtsClient milik TutorModule: tutor punya suara + gaya bicara per
 * karakter dan kunci cache sendiri, sedangkan audio pelajaran hanya mengenal dua suara ('female' | 'male') dengan
 * kunci cache tetap (hashAudioKey(teks, voice)) yang tidak boleh berubah antar penyedia -- endpoint pelajaran mencari
 * audio dengan kunci itu.
 *
 * Konstruktor menerima NILAI MENTAH (bukan ConfigService) supaya seed.ts dan tts-sample.ts, yang jalan di luar
 * container DI Nest, bisa membuatnya langsung dari `process.env`. */
export class OpenAiTtsClient extends TtsClient {
  readonly configured: boolean;
  private readonly client: OpenAI | undefined;

  constructor(
    apiKey: string | undefined,
    private readonly model: string,
    private readonly voiceFemale: string,
    private readonly voiceMale: string,
    private readonly instructions?: string,
  ) {
    super();
    const key = apiKey?.trim();
    this.configured = Boolean(key);
    // Klien dibuat hanya bila ada kunci: `new OpenAI({ apiKey: undefined })` diam-diam membaca OPENAI_API_KEY dari
    // environment lalu melempar galat generik bila kosong -- kita ingin pesan sendiri yang menyebut TTS_PROVIDER.
    this.client = key ? new OpenAI({ apiKey: key, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES }) : undefined;
  }

  async synthesize(textJp: string, voice: AudioVoice): Promise<Buffer> {
    if (!this.client) {
      throw new Error(
        "OPENAI_API_KEY belum diisi -- audio TTS pelajaran (TTS_PROVIDER=openai) tidak bisa digenerate. " +
          "Isi kuncinya, atau pakai Azure (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION). Lihat apps/api/.env.example.",
      );
    }

    const voiceName = voice === "male" ? this.voiceMale : this.voiceFemale;
    let audio: Buffer;
    try {
      const response = await this.client.audio.speech.create({
        model: this.model,
        voice: voiceName,
        input: textJp,
        instructions: this.effectiveInstructions(),
        // mp3: AudioService selalu menyimpan sebagai `audio/${hash}.mp3` dengan content-type audio/mpeg.
        response_format: "mp3",
      });
      audio = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new Error(`OpenAI TTS gagal (model ${this.model}, suara ${voiceName}): ${redactSecrets(error instanceof Error ? error.message : String(error))}`);
    }

    // Badan kosong bukan audio -- jangan sampai tersimpan di cache sebagai berkas 0 byte yang lalu dianggap "sudah ada".
    if (audio.length === 0) {
      throw new Error(`OpenAI TTS mengembalikan audio kosong (model ${this.model}, suara ${voiceName}) untuk '${textJp}'.`);
    }
    return audio;
  }

  // `instructions` tidak didukung `tts-1`/`tts-1-hd` (dokumentasi SDK) -- dikirim ke model itu bisa ditolak 400, jadi
  // hanya dipakai untuk keluarga `gpt-*-tts`.
  private effectiveInstructions(): string | undefined {
    if (/^tts-1/.test(this.model)) return undefined;
    return this.instructions?.trim() || undefined;
  }
}

/** Pesan galat penyedia kadang memuat potongan kunci API; log seed/CLI jangan sampai menyimpannya. */
function redactSecrets(message: string): string {
  return message.replace(/\bsk-[A-Za-z0-9_*.-]{6,}/g, "sk-***");
}
