import OpenAI, { toFile } from "openai";

export interface TutorAudioUpload {
  audio: Buffer;
  /** Nama file DENGAN ekstensi yang benar -- OpenAI menebak format audio dari
   * ekstensi, dan blob rekaman browser sering dikirim tanpa nama/ekstensi. */
  filename: string;
  mimetype: string;
}

/** Seam speech-to-text (`/tutor/transcribe`) -- pola sama `TutorLlmClient`.
 * Implementasi sungguhan: `OpenAiSpeechToTextClient`. */
export abstract class SpeechToTextClient {
  abstract readonly configured: boolean;
  abstract transcribe(upload: TutorAudioUpload): Promise<string>;
}

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;

export class OpenAiSpeechToTextClient extends SpeechToTextClient {
  readonly configured = true;
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    super();
    this.client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
  }

  async transcribe({ audio, filename, mimetype }: TutorAudioUpload): Promise<string> {
    const file = await toFile(audio, filename, { type: mimetype });
    // `language: "ja"` hardcode -- persis versi lama: murid melatih Bahasa
    // Jepang, deteksi bahasa otomatis justru sering salah tebak untuk ucapan
    // pendek pemula yang pengucapannya belum akurat.
    const result = await this.client.audio.transcriptions.create({ file, model: this.model, language: "ja" });
    return result.text.trim();
  }
}

export class UnconfiguredSpeechToTextClient extends SpeechToTextClient {
  readonly configured = false;

  async transcribe(): Promise<string> {
    throw new Error("OPENAI_API_KEY belum diisi");
  }
}
