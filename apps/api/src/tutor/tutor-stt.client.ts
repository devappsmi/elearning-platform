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
/** Berapa kali dicoba ulang SETELAH percobaan pertama -- sama dengan klien LLM dan TTS. */
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 400;

/** Galat yang layak dicoba sekali lagi: aturan yang sama dengan retry bawaan SDK -- 408/409/429/5xx dan sambungan
 * putus atau timeout. Salah permintaan atau kunci (400/401/413/415 ...) tidak akan membaik bila diulang. */
function isTransient(error: unknown): boolean {
  if (error instanceof OpenAI.APIConnectionError) return true; // termasuk APIConnectionTimeoutError
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && (status === 408 || status === 409 || status === 429 || status >= 500);
}

export class OpenAiSpeechToTextClient extends SpeechToTextClient {
  readonly configured = true;
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    super();
    // Retry bawaan SDK sengaja dimatikan: untuk unggahan multipart (v4) permintaan ulangnya terkirim dengan header
    // tetapi TANPA isi, sehingga menggantung sampai timeout (45 dtk) lalu gagal -- murid menatap "Mengenali
    // suaramu..." tanpa guna. Percobaan ulang dilakukan di `transcribe` sebagai permintaan baru yang utuh.
    this.client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  }

  async transcribe({ audio, filename, mimetype }: TutorAudioUpload): Promise<string> {
    const file = await toFile(audio, filename, { type: mimetype });
    for (let attempt = 0; ; attempt += 1) {
      try {
        // `language: "ja"` hardcode -- persis versi lama: murid melatih Bahasa
        // Jepang, deteksi bahasa otomatis justru sering salah tebak untuk ucapan
        // pendek pemula yang pengucapannya belum akurat.
        const result = await this.client.audio.transcriptions.create({ file, model: this.model, language: "ja" });
        return result.text.trim();
      } catch (error) {
        if (attempt >= MAX_RETRIES || !isTransient(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
}

export class UnconfiguredSpeechToTextClient extends SpeechToTextClient {
  readonly configured = false;

  async transcribe(): Promise<string> {
    throw new Error("OPENAI_API_KEY belum diisi");
  }
}
