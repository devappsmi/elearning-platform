import { afterEach, describe, expect, it, vi } from "vitest";
import { AzureTtsClient } from "./azure-tts.client";

// Azure dipanggil lewat `fetch` global ke alamat tetap `https://{region}.tts.speech.microsoft.com`, jadi tesnya
// menggantikan `fetch` (bukan server lokal). Yang teruji: bentuk request (alamat, header, SSML) dan pemetaan
// respons/galat; suara Azure sungguhan tidak teruji tanpa kunci Azure.

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const MP3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0xff, 0xfb, 0x90]);

function client(): AzureTtsClient {
  return new AzureTtsClient("kunci-azure", "japaneast", "ja-JP-NanamiNeural", "ja-JP-KeitaNeural");
}

describe("AzureTtsClient", () => {
  it("configured hanya bila kunci DAN region terisi", () => {
    expect(client().configured).toBe(true);
    expect(new AzureTtsClient(undefined, "japaneast", "f", "m").configured).toBe(false);
    expect(new AzureTtsClient("kunci", undefined, "f", "m").configured).toBe(false);
    expect(new AzureTtsClient("", "", "f", "m").configured).toBe(false);
  });

  it("belum dikonfigurasi: menolak dengan pesan yang menyebut Azure DAN alternatif OpenAI, tanpa panggilan jaringan", async () => {
    const fetchMock = stubFetch(new Response(MP3));

    const error = await new AzureTtsClient(undefined, undefined, "f", "m").synthesize("あ", "female").catch((e: unknown) => e as Error);

    expect(error.message).toContain("AZURE_SPEECH_KEY/AZURE_SPEECH_REGION");
    expect(error.message).toContain("TTS_PROVIDER=openai");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST ke alamat region dengan kunci, tipe SSML, format mp3; SSML memuat suara perempuan dan teksnya", async () => {
    const fetchMock = stubFetch(new Response(MP3));

    const audio = await client().synthesize("こんにちは", "female");

    expect(Buffer.compare(audio, MP3)).toBe(0);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://japaneast.tts.speech.microsoft.com/cognitiveservices/v1");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Ocp-Apim-Subscription-Key": "kunci-azure",
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-64kbitrate-mono-mp3",
    });
    expect(init.body).toBe('<speak version="1.0" xml:lang="ja-JP"><voice name="ja-JP-NanamiNeural">こんにちは</voice></speak>');
  });

  it("suara laki-laki memakai suara laki-lakinya", async () => {
    const fetchMock = stubFetch(new Response(MP3));

    await client().synthesize("こんにちは", "male");

    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].body).toContain('<voice name="ja-JP-KeitaNeural">');
  });

  it("karakter khusus XML di teks di-escape (teks tidak bisa menyisipkan elemen SSML)", async () => {
    const fetchMock = stubFetch(new Response(MP3));

    await client().synthesize(`</voice><x a="1">&'`, "female");

    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string;
    expect(body).toContain("&lt;/voice&gt;&lt;x a=&quot;1&quot;&gt;&amp;&apos;");
    expect(body.match(/<voice /g)).toHaveLength(1);
  });

  it("respons non-2xx: galat memuat status HTTP dan badan respons", async () => {
    stubFetch(new Response("Access denied due to invalid subscription key", { status: 401 }));

    await expect(client().synthesize("あ", "female")).rejects.toThrow("Azure TTS gagal (HTTP 401): Access denied due to invalid subscription key");
  });
});
