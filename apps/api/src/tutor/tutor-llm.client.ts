import OpenAI from "openai";

/** Seam LLM untuk balasan AI tutor -- abstract class sebagai token DI (pola
 * sama `TtsClient`), supaya provider bisa diganti (dan `TutorService`
 * dites) tanpa menyentuh logic kuota/prompt. Implementasi sungguhan:
 * `OpenAiTutorLlmClient` (Responses API, sesuai versi lama). */
export abstract class TutorLlmClient {
  /** false = server ini belum punya kredensial -- `TutorService` menolak
   * (503) SEBELUM menyentuh kuota, supaya server yang salah konfigurasi tidak
   * diam-diam menghabiskan kuota murid tanpa panggilan API sungguhan. */
  abstract readonly configured: boolean;
  abstract reply(params: { instructions: string; input: string }): Promise<string>;
}

// Default SDK: timeout 10 menit + 2 retry -- terlalu lama untuk endpoint
// interaktif (murid menunggu di layar). Batasi supaya kasus terburuk tetap
// terukur.
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;

export class OpenAiTutorLlmClient extends TutorLlmClient {
  readonly configured = true;
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    super();
    // Base URL mengikuti env `OPENAI_BASE_URL` bawaan SDK (gateway
    // kompatibel-OpenAI / server tiruan untuk verifikasi) -- tidak ada opsi
    // konfigurasi tambahan di sini.
    this.client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
  }

  async reply({ instructions, input }: { instructions: string; input: string }): Promise<string> {
    // `store: false` -- isi percakapan murid TIDAK perlu disimpan di sisi
    // OpenAI (kita stateless, tidak memakai previous_response_id); minimasi
    // data yang keluar dari sistem kita.
    const response = await this.client.responses.create({ model: this.model, instructions, input, store: false });
    const text = response.output_text?.trim();
    if (!text) throw new Error("OpenAI mengembalikan balasan kosong");
    return text;
  }
}

export class UnconfiguredTutorLlmClient extends TutorLlmClient {
  readonly configured = false;

  async reply(): Promise<string> {
    throw new Error("OPENAI_API_KEY belum diisi");
  }
}
