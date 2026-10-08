import { createHash } from "node:crypto";
import OpenAI from "openai";

export interface TutorSynthesisRequest {
  text: string;
  voice: string;
  instructions?: string;
}

/** Seam TTS khusus tutor (`/tutor/speak`) -- BEDA dari `TtsClient` milik
 * AudioModule (Azure, voice cuma 'female'|'male', untuk konten lesson):
 * tutor butuh voice + instruksi gaya bicara PER KARAKTER. Audio-nya tetap
 * lewat jalur cache yang sama (`AudioService.resolveAudioUrlWith`), cuma
 * penyedia sintesisnya yang berbeda. */
export abstract class TutorTtsClient {
  abstract readonly configured: boolean;
  /** Voice bawaan kalau `/tutor/speak` tidak menyebut karakter
   * (`OPENAI_TTS_VOICE_DEFAULT`). */
  abstract readonly defaultVoice: string;
  /** Kunci cache untuk kombinasi setelan sintesis ini -- HARUS memuat semua
   * yang mengubah bunyi audio (provider, model, voice, instruksi), supaya
   * mengubah salah satunya tidak menyajikan audio basi dari cache. */
  abstract voiceKey(voice: string, instructions?: string): string;
  abstract synthesize(request: TutorSynthesisRequest): Promise<Buffer>;
}

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;

export class OpenAiTutorTtsClient extends TutorTtsClient {
  readonly configured = true;
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    readonly defaultVoice: string,
  ) {
    super();
    this.client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
  }

  // `instructions` tidak didukung `tts-1`/`tts-1-hd` (dokumentasi SDK) --
  // dikirim ke model itu bisa ditolak 400, jadi cuma dipakai untuk keluarga
  // `gpt-*-tts`.
  private effectiveInstructions(instructions?: string): string | undefined {
    if (/^tts-1/.test(this.model)) return undefined;
    return instructions?.trim() || undefined;
  }

  voiceKey(voice: string, instructions?: string): string {
    const digest = createHash("sha256").update(this.effectiveInstructions(instructions) ?? "").digest("hex").slice(0, 8);
    return `openai:${this.model}:${voice}:${digest}`;
  }

  async synthesize({ text, voice, instructions }: TutorSynthesisRequest): Promise<Buffer> {
    const response = await this.client.audio.speech.create({
      model: this.model,
      voice,
      input: text,
      instructions: this.effectiveInstructions(instructions),
      // mp3: AudioService selalu menyimpan sebagai `audio/${hash}.mp3`
      // dengan content-type audio/mpeg.
      response_format: "mp3",
    });
    return Buffer.from(await response.arrayBuffer());
  }
}

export class UnconfiguredTutorTtsClient extends TutorTtsClient {
  readonly configured = false;

  constructor(readonly defaultVoice: string) {
    super();
  }

  voiceKey(voice: string): string {
    return `unconfigured:${voice}`;
  }

  async synthesize(): Promise<Buffer> {
    throw new Error("OPENAI_API_KEY belum diisi");
  }
}
