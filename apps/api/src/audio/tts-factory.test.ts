import { describe, expect, it } from "vitest";
import { AzureTtsClient } from "./azure-tts.client";
import { OpenAiTtsClient } from "./openai-tts.client";
import { createTtsClient, UnavailableTtsClient } from "./tts-factory";
import { resolveTtsOptions, ttsUnavailableReason } from "./tts-options";

const AZURE = { AZURE_SPEECH_KEY: "kunci-azure", AZURE_SPEECH_REGION: "japaneast" };
const OPENAI = { OPENAI_API_KEY: "sk-kunci-openai" };

describe("createTtsClient", () => {
  it("azure lengkap -> AzureTtsClient yang configured", () => {
    const client = createTtsClient(resolveTtsOptions(AZURE));

    expect(client).toBeInstanceOf(AzureTtsClient);
    expect(client.configured).toBe(true);
  });

  it("azure dipaksa tanpa kredensial -> AzureTtsClient yang TIDAK configured", () => {
    const client = createTtsClient(resolveTtsOptions({ TTS_PROVIDER: "azure" }));

    expect(client).toBeInstanceOf(AzureTtsClient);
    expect(client.configured).toBe(false);
  });

  it("openai dengan kunci -> OpenAiTtsClient yang configured", () => {
    const client = createTtsClient(resolveTtsOptions(OPENAI));

    expect(client).toBeInstanceOf(OpenAiTtsClient);
    expect(client.configured).toBe(true);
  });

  it("openai dipaksa tanpa kunci -> OpenAiTtsClient yang TIDAK configured", () => {
    const client = createTtsClient(resolveTtsOptions({ TTS_PROVIDER: "openai" }));

    expect(client).toBeInstanceOf(OpenAiTtsClient);
    expect(client.configured).toBe(false);
  });

  it("none -> UnavailableTtsClient yang tidak configured (dimatikan maupun tanpa kredensial)", () => {
    for (const env of [{ TTS_PROVIDER: "none", ...OPENAI }, {}]) {
      const client = createTtsClient(resolveTtsOptions(env));

      expect(client).toBeInstanceOf(UnavailableTtsClient);
      expect(client.configured).toBe(false);
    }
  });
});

describe("UnavailableTtsClient", () => {
  it("dimatikan (TTS_PROVIDER=none): pesan menyebut TTS_PROVIDER, bukan meminta kredensial", async () => {
    const error = await createTtsClient(resolveTtsOptions({ TTS_PROVIDER: "none" })).synthesize("あ", "female").catch((e: unknown) => e as Error);

    expect(error.message).toContain("TTS_PROVIDER=none");
    expect(error.message).not.toContain("OPENAI_API_KEY");
  });

  it("tanpa kredensial (auto): pesan menunjuk KEDUA cara mengaktifkannya (OpenAI dan Azure)", async () => {
    const error = await createTtsClient(resolveTtsOptions({})).synthesize("あ", "female").catch((e: unknown) => e as Error);

    expect(error.message).toContain("OPENAI_API_KEY");
    expect(error.message).toContain("AZURE_SPEECH_KEY");
    expect(error.message).toContain("AZURE_SPEECH_REGION");
  });
});

describe("konsistensi: alasan tak-siap (opsi) == configured (klien)", () => {
  const MATRIX: Record<string, string>[] = [
    {},
    { OPENAI_API_KEY: "sk-x" },
    { OPENAI_API_KEY: "   " },
    { AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "japaneast" },
    { AZURE_SPEECH_KEY: "k" },
    { AZURE_SPEECH_REGION: "japaneast" },
    { AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "japaneast", OPENAI_API_KEY: "sk-x" },
    ...["auto", "azure", "openai", "none"].flatMap((TTS_PROVIDER) => [
      { TTS_PROVIDER },
      { TTS_PROVIDER, OPENAI_API_KEY: "sk-x" },
      { TTS_PROVIDER, AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "japaneast" },
      { TTS_PROVIDER, AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "japaneast", OPENAI_API_KEY: "sk-x" },
    ]),
  ];

  it.each(MATRIX.map((env) => [JSON.stringify(env), env] as const))("%s", (_nama, env) => {
    const options = resolveTtsOptions(env);

    expect(ttsUnavailableReason(options) === null).toBe(createTtsClient(options).configured);
  });
});

