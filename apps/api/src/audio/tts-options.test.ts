import { describe, expect, it } from "vitest";
import {
  DEFAULT_AZURE_VOICE_FEMALE,
  DEFAULT_AZURE_VOICE_MALE,
  DEFAULT_OPENAI_LESSON_INSTRUCTIONS,
  DEFAULT_OPENAI_LESSON_VOICE_FEMALE,
  DEFAULT_OPENAI_LESSON_VOICE_MALE,
  DEFAULT_OPENAI_TTS_MODEL,
  TTS_PROVIDER_CHOICES,
  describeTtsOptions,
  resolveTtsOptions,
  ttsFingerprint,
  ttsUnavailableReason,
  type TtsOptions,
} from "./tts-options";

const AZURE = { AZURE_SPEECH_KEY: "kunci-azure", AZURE_SPEECH_REGION: "japaneast" };
const OPENAI = { OPENAI_API_KEY: "sk-kunci-openai" };

describe("resolveTtsOptions -- TTS_PROVIDER=auto (bawaan)", () => {
  it("tanpa kredensial apa pun: none/unconfigured (audio kosong, aplikasi tetap jalan)", () => {
    expect(resolveTtsOptions({})).toEqual({ provider: "none", reason: "unconfigured" });
  });

  it("hanya OPENAI_API_KEY (kunci AI tutor): memakai OpenAI -- jalur untuk yang belum punya Azure", () => {
    const options = resolveTtsOptions(OPENAI);

    expect(options).toMatchObject({ provider: "openai", apiKey: "sk-kunci-openai" });
  });

  it("hanya Azure lengkap: memakai Azure", () => {
    expect(resolveTtsOptions(AZURE)).toMatchObject({ provider: "azure", speechKey: "kunci-azure", speechRegion: "japaneast" });
  });

  it("keduanya terisi: Azure menang (rekomendasi plan); OpenAI dipilih dengan TTS_PROVIDER=openai", () => {
    expect(resolveTtsOptions({ ...AZURE, ...OPENAI }).provider).toBe("azure");
    expect(resolveTtsOptions({ ...AZURE, ...OPENAI, TTS_PROVIDER: "openai" }).provider).toBe("openai");
  });

  it("Azure setengah terisi (kunci tanpa region, atau sebaliknya) BUKAN Azure yang siap: jatuh ke OpenAI / none", () => {
    expect(resolveTtsOptions({ AZURE_SPEECH_KEY: "kunci-azure", ...OPENAI }).provider).toBe("openai");
    expect(resolveTtsOptions({ AZURE_SPEECH_REGION: "japaneast", ...OPENAI }).provider).toBe("openai");
    expect(resolveTtsOptions({ AZURE_SPEECH_KEY: "kunci-azure" })).toEqual({ provider: "none", reason: "unconfigured" });
  });

  it("nilai kosong / hanya spasi (baris `OPENAI_API_KEY=` di .env atau compose) dianggap tidak diisi", () => {
    expect(resolveTtsOptions({ OPENAI_API_KEY: "", AZURE_SPEECH_KEY: "  ", AZURE_SPEECH_REGION: "\t" })).toEqual({
      provider: "none",
      reason: "unconfigured",
    });
  });

  it("TTS_PROVIDER kosong atau hanya spasi = auto", () => {
    expect(resolveTtsOptions({ ...OPENAI, TTS_PROVIDER: "" }).provider).toBe("openai");
    expect(resolveTtsOptions({ ...OPENAI, TTS_PROVIDER: "   " }).provider).toBe("openai");
  });
});

describe("resolveTtsOptions -- pilihan eksplisit", () => {
  it("TTS_PROVIDER=none mematikan audio walau kunci ada", () => {
    expect(resolveTtsOptions({ ...AZURE, ...OPENAI, TTS_PROVIDER: "none" })).toEqual({ provider: "none", reason: "disabled" });
  });

  it("TTS_PROVIDER=openai tanpa kunci: tetap penyedia openai (tanpa kunci) -- galat yang jelas muncul saat dipakai, bukan diam-diam none", () => {
    expect(resolveTtsOptions({ TTS_PROVIDER: "openai" })).toMatchObject({ provider: "openai", apiKey: undefined });
  });

  it("TTS_PROVIDER=azure tanpa kredensial: tetap penyedia azure (tanpa kunci), walau OpenAI ada", () => {
    expect(resolveTtsOptions({ TTS_PROVIDER: "azure", ...OPENAI })).toMatchObject({ provider: "azure", speechKey: undefined, speechRegion: undefined });
  });

  it("huruf besar dan spasi di sekitar nama diabaikan", () => {
    expect(resolveTtsOptions({ ...OPENAI, TTS_PROVIDER: "  OpenAI " }).provider).toBe("openai");
    expect(resolveTtsOptions({ TTS_PROVIDER: "NONE" }).provider).toBe("none");
  });

  it("nama tak dikenal: galat yang menyebut nilainya dan semua pilihan (salah ketik tidak boleh diam-diam jadi auto)", () => {
    const run = () => resolveTtsOptions({ ...OPENAI, TTS_PROVIDER: "opnai" });

    expect(run).toThrow(/TTS_PROVIDER="opnai"/);
    expect(run).toThrow(new RegExp(TTS_PROVIDER_CHOICES.join(", ")));
  });
});

describe("resolveTtsOptions -- nilai bawaan dan penggantian", () => {
  it("OpenAI: model, suara, dan instruksi bawaan", () => {
    expect(resolveTtsOptions(OPENAI)).toEqual({
      provider: "openai",
      apiKey: "sk-kunci-openai",
      model: DEFAULT_OPENAI_TTS_MODEL,
      voiceFemale: DEFAULT_OPENAI_LESSON_VOICE_FEMALE,
      voiceMale: DEFAULT_OPENAI_LESSON_VOICE_MALE,
      instructions: DEFAULT_OPENAI_LESSON_INSTRUCTIONS,
    });
    expect(DEFAULT_OPENAI_TTS_MODEL).toBe("gpt-4o-mini-tts");
  });

  it("OpenAI: model dan suara bisa diganti; nilai di-trim; kosong = bawaan", () => {
    const options = resolveTtsOptions({
      ...OPENAI,
      OPENAI_TTS_MODEL: " tts-1-hd ",
      OPENAI_LESSON_TTS_VOICE_FEMALE: " coral",
      OPENAI_LESSON_TTS_VOICE_MALE: "",
      OPENAI_LESSON_TTS_INSTRUCTIONS: "  Speak slowly.  ",
    });

    expect(options).toMatchObject({ model: "tts-1-hd", voiceFemale: "coral", voiceMale: DEFAULT_OPENAI_LESSON_VOICE_MALE, instructions: "Speak slowly." });
  });

  it("OpenAI: instruksi kosong/spasi kembali ke instruksi bawaan (bukan tanpa instruksi)", () => {
    expect(resolveTtsOptions({ ...OPENAI, OPENAI_LESSON_TTS_INSTRUCTIONS: "   " })).toMatchObject({ instructions: DEFAULT_OPENAI_LESSON_INSTRUCTIONS });
  });

  it("instruksi bawaan menyebut bahasa Jepang dan tempo pelan (mencegah 'あ' ditebak sebagai bahasa Inggris)", () => {
    expect(DEFAULT_OPENAI_LESSON_INSTRUCTIONS).toMatch(/Japanese/);
    expect(DEFAULT_OPENAI_LESSON_INSTRUCTIONS).toMatch(/slow/);
  });

  it("Azure: suara bawaan dan penggantian; kunci/region di-trim", () => {
    expect(resolveTtsOptions(AZURE)).toEqual({
      provider: "azure",
      speechKey: "kunci-azure",
      speechRegion: "japaneast",
      voiceFemale: DEFAULT_AZURE_VOICE_FEMALE,
      voiceMale: DEFAULT_AZURE_VOICE_MALE,
    });
    expect(
      resolveTtsOptions({ AZURE_SPEECH_KEY: " k ", AZURE_SPEECH_REGION: " japaneast ", AZURE_TTS_VOICE_FEMALE: "ja-JP-AoiNeural", AZURE_TTS_VOICE_MALE: "" }),
    ).toMatchObject({ speechKey: "k", speechRegion: "japaneast", voiceFemale: "ja-JP-AoiNeural", voiceMale: DEFAULT_AZURE_VOICE_MALE });
  });

  it("suara OpenAI untuk pelajaran tidak bercampur dengan OPENAI_TTS_VOICE_DEFAULT milik tutor", () => {
    const options = resolveTtsOptions({ ...OPENAI, OPENAI_TTS_VOICE_DEFAULT: "shimmer" } as Record<string, string>);

    expect(options).toMatchObject({ voiceFemale: DEFAULT_OPENAI_LESSON_VOICE_FEMALE });
  });
});

describe("describeTtsOptions", () => {
  it("ringkasan tiap penyedia memuat model/region dan suara", () => {
    expect(describeTtsOptions(resolveTtsOptions(OPENAI))).toBe("openai (model gpt-4o-mini-tts; suara perempuan=nova, laki-laki=onyx)");
    expect(describeTtsOptions(resolveTtsOptions(AZURE))).toBe("azure (region japaneast; suara perempuan=ja-JP-NanamiNeural, laki-laki=ja-JP-KeitaNeural)");
    expect(describeTtsOptions(resolveTtsOptions({ TTS_PROVIDER: "none" }))).toContain("TTS_PROVIDER=none");
    expect(describeTtsOptions(resolveTtsOptions({}))).toContain("tidak ada kredensial");
  });

  it("TIDAK PERNAH memuat kunci API maupun instruksi", () => {
    const all = [
      describeTtsOptions(resolveTtsOptions({ ...OPENAI, OPENAI_LESSON_TTS_INSTRUCTIONS: "instruksi-rahasia" })),
      describeTtsOptions(resolveTtsOptions(AZURE)),
      describeTtsOptions(resolveTtsOptions({ TTS_PROVIDER: "azure" })),
    ].join("\n");

    expect(all).not.toContain("sk-kunci-openai");
    expect(all).not.toContain("kunci-azure");
    expect(all).not.toContain("instruksi-rahasia");
  });

  it("Azure tanpa region menampilkan '-' (tidak 'undefined')", () => {
    expect(describeTtsOptions(resolveTtsOptions({ TTS_PROVIDER: "azure" }))).toContain("region -;");
  });
});

describe("ttsFingerprint (nama berkas contoh suara)", () => {
  const base = resolveTtsOptions(OPENAI);

  it("8 karakter hex, deterministik", () => {
    expect(ttsFingerprint(base)).toMatch(/^[0-9a-f]{8}$/);
    expect(ttsFingerprint(base)).toBe(ttsFingerprint(resolveTtsOptions(OPENAI)));
  });

  it("berubah bila apa pun yang mengubah BUNYI berubah: suara, model, instruksi, penyedia, region", () => {
    const seen = new Set<string>([ttsFingerprint(base)]);
    const variants: TtsOptions[] = [
      resolveTtsOptions({ ...OPENAI, OPENAI_LESSON_TTS_VOICE_FEMALE: "coral" }),
      resolveTtsOptions({ ...OPENAI, OPENAI_LESSON_TTS_VOICE_MALE: "echo" }),
      resolveTtsOptions({ ...OPENAI, OPENAI_TTS_MODEL: "tts-1-hd" }),
      resolveTtsOptions({ ...OPENAI, OPENAI_LESSON_TTS_INSTRUCTIONS: "Speak faster." }),
      resolveTtsOptions(AZURE),
      resolveTtsOptions({ ...AZURE, AZURE_SPEECH_REGION: "eastasia" }),
      resolveTtsOptions({ ...AZURE, AZURE_TTS_VOICE_FEMALE: "ja-JP-AoiNeural" }),
      resolveTtsOptions({ TTS_PROVIDER: "none" }),
    ];
    for (const variant of variants) seen.add(ttsFingerprint(variant));

    expect(seen.size).toBe(variants.length + 1);
  });

  it("TIDAK berubah bila hanya kunci yang berubah (rahasia tidak ikut menentukan nama berkas)", () => {
    expect(ttsFingerprint(resolveTtsOptions({ OPENAI_API_KEY: "sk-lain-sekali" }))).toBe(ttsFingerprint(base));
    expect(ttsFingerprint(resolveTtsOptions({ ...AZURE, AZURE_SPEECH_KEY: "kunci-lain" }))).toBe(ttsFingerprint(resolveTtsOptions(AZURE)));
  });
});

describe("ttsUnavailableReason (pesan seed)", () => {
  it("kredensial lengkap -> null", () => {
    expect(ttsUnavailableReason(resolveTtsOptions(OPENAI))).toBeNull();
    expect(ttsUnavailableReason(resolveTtsOptions(AZURE))).toBeNull();
  });

  it("dimatikan lewat TTS_PROVIDER=none -> menyebut variabelnya", () => {
    expect(ttsUnavailableReason(resolveTtsOptions({ TTS_PROVIDER: "none", ...OPENAI }))).toContain("TTS_PROVIDER=none");
  });

  it("auto tanpa kredensial -> 'tidak ada kredensial TTS yang terisi'", () => {
    expect(ttsUnavailableReason(resolveTtsOptions({}))).toBe("tidak ada kredensial TTS yang terisi");
  });

  it("penyedia dipaksa tanpa kredensialnya -> menyebut penyedia DAN variabel yang kosong", () => {
    expect(ttsUnavailableReason(resolveTtsOptions({ TTS_PROVIDER: "openai" }))).toBe("TTS_PROVIDER=openai tetapi OPENAI_API_KEY kosong");
    expect(ttsUnavailableReason(resolveTtsOptions({ TTS_PROVIDER: "azure", AZURE_SPEECH_KEY: "k" }))).toContain("AZURE_SPEECH_KEY/AZURE_SPEECH_REGION belum lengkap");
  });
});

