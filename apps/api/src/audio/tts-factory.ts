import type { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.validation";
import { AzureTtsClient } from "./azure-tts.client";
import { OpenAiTtsClient } from "./openai-tts.client";
import { TtsClient } from "./tts-client";
import { resolveTtsOptions, ttsEnvFromConfig, type TtsOptions } from "./tts-options";

/** Klien untuk `TTS_PROVIDER=none` atau mode auto tanpa kredensial apa pun: tidak pernah memanggil jaringan, dan
 * `synthesize` menolak dengan pesan yang menunjuk cara mengaktifkannya. */
export class UnavailableTtsClient extends TtsClient {
  readonly configured = false;

  constructor(private readonly reason: "disabled" | "unconfigured") {
    super();
  }

  async synthesize(): Promise<Buffer> {
    throw new Error(
      this.reason === "disabled"
        ? "TTS_PROVIDER=none -- pembuatan audio pelajaran dimatikan. Ubah TTS_PROVIDER untuk mengaktifkannya."
        : "Belum ada penyedia TTS yang dikonfigurasi -- audio pelajaran tidak bisa digenerate. " +
            "Isi OPENAI_API_KEY (kunci yang sama dengan AI tutor) atau AZURE_SPEECH_KEY + AZURE_SPEECH_REGION. Lihat apps/api/.env.example.",
    );
  }
}

/** Membuat klien TTS dari opsi hasil `resolveTtsOptions` -- dipakai AudioModule (API), seed.ts, dan tts-sample.ts. */
export function createTtsClient(options: TtsOptions): TtsClient {
  switch (options.provider) {
    case "azure":
      return new AzureTtsClient(options.speechKey, options.speechRegion, options.voiceFemale, options.voiceMale);
    case "openai":
      return new OpenAiTtsClient(options.apiKey, options.model, options.voiceFemale, options.voiceMale, options.instructions);
    case "none":
      return new UnavailableTtsClient(options.reason);
  }
}

/** Klien TTS dari ConfigService (env yang sudah divalidasi) -- persis yang dipakai AudioModule untuk provider TtsClient. */
export function ttsClientFromConfig(config: ConfigService<Env, true>): TtsClient {
  return createTtsClient(resolveTtsOptions(ttsEnvFromConfig(config)));
}
