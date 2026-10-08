import { TtsClient } from "./tts-client";
import type { AudioVoice } from "./audio-hash.util";

/** Port dari plan bagian 9 (rekomendasi TTS materi): Azure Cognitive Speech
 * REST API dipanggil langsung (bukan `microsoft-cognitiveservices-speech-sdk`
 * -- SDK itu untuk skenario streaming/real-time, di sini cukup satu request
 * SSML -> audio sekali jalan, HTTP polos lebih ringan dan konsisten dengan
 * cara `openai` npm dipakai langsung di tempat lain di codebase ini).
 *
 * Konstruktor sengaja menerima NILAI MENTAH (bukan ConfigService NestJS) --
 * `seed.ts` jalan di luar Nest DI container dan perlu bisa membuat instance
 * ini langsung dari `process.env`. AudioModule menyediakan wiring NestJS-nya
 * lewat factory (lihat audio.module.ts). */
export class AzureTtsClient extends TtsClient {
  readonly configured: boolean;

  constructor(
    private readonly speechKey: string | undefined,
    private readonly speechRegion: string | undefined,
    private readonly voiceFemale: string,
    private readonly voiceMale: string,
  ) {
    super();
    this.configured = Boolean(speechKey && speechRegion);
  }

  async synthesize(textJp: string, voice: AudioVoice): Promise<Buffer> {
    if (!this.speechKey || !this.speechRegion) {
      throw new Error(
        "AZURE_SPEECH_KEY/AZURE_SPEECH_REGION belum diisi -- audio TTS pelajaran (TTS_PROVIDER=azure) tidak bisa digenerate. " +
          "Isi keduanya, atau pakai OpenAI (isi OPENAI_API_KEY dan TTS_PROVIDER=openai). Lihat apps/api/.env.example.",
      );
    }

    const voiceName = voice === "male" ? this.voiceMale : this.voiceFemale;
    const ssml = `<speak version="1.0" xml:lang="ja-JP"><voice name="${voiceName}">${escapeXml(textJp)}</voice></speak>`;

    const res = await fetch(`https://${this.speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.speechKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-64kbitrate-mono-mp3",
        "User-Agent": "elearning-platform",
      },
      body: ssml,
    });

    if (!res.ok) {
      throw new Error(`Azure TTS gagal (HTTP ${res.status}): ${await res.text()}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}
