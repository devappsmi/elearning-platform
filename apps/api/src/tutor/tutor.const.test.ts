import { describe, expect, it } from "vitest";
import {
  DEFAULT_TUTOR_CHARACTER_ID,
  TUTOR_CHARACTERS,
  TUTOR_SCENARIOS,
  findTutorCharacter,
  findTutorScenario,
} from "./tutor.const";

// Nama voice bawaan OpenAI TTS -- salah ketik di data karakter baru ketahuan
// di sini, bukan sebagai 400 dari provider saat murid menekan tombol suara.
const OPENAI_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"];

describe("data statis AI tutor", () => {
  it("id skenario dan karakter dari versi lama tetap ada", () => {
    expect(TUTOR_SCENARIOS.map((s) => s.id)).toEqual(["perkenalan", "restoran", "arah", "belanja"]);
    expect(TUTOR_CHARACTERS.map((c) => c.id)).toEqual(["yuki", "kenji", "sora"]);
  });

  it("id unik", () => {
    expect(new Set(TUTOR_SCENARIOS.map((s) => s.id)).size).toBe(TUTOR_SCENARIOS.length);
    expect(new Set(TUTOR_CHARACTERS.map((c) => c.id)).size).toBe(TUTOR_CHARACTERS.length);
  });

  it("karakter bawaan ada, dan yuki bersuara nova (tercatat dari versi lama)", () => {
    const fallback = findTutorCharacter(DEFAULT_TUTOR_CHARACTER_ID);
    expect(fallback?.id).toBe("yuki");
    expect(fallback?.voice).toBe("nova");
  });

  it("setiap karakter memakai nama voice OpenAI yang valid dan punya instruksi gaya bicara", () => {
    for (const character of TUTOR_CHARACTERS) {
      expect(OPENAI_VOICES, `voice ${character.voice} milik ${character.id}`).toContain(character.voice);
      expect(character.voiceInstructions.trim().length).toBeGreaterThan(0);
      expect(character.personality.trim().length).toBeGreaterThan(0);
    }
  });

  it("setiap skenario punya judul, deskripsi, dan system prompt terisi", () => {
    for (const scenario of TUTOR_SCENARIOS) {
      expect(scenario.title.trim().length).toBeGreaterThan(0);
      expect(scenario.description.trim().length).toBeGreaterThan(0);
      expect(scenario.systemPrompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("find* mengembalikan undefined untuk id tak dikenal", () => {
    expect(findTutorScenario("restoran")?.title).toBe("Di Restoran");
    expect(findTutorScenario("tidak-ada")).toBeUndefined();
    expect(findTutorCharacter("kenji")?.name).toBe("Kenji");
    expect(findTutorCharacter("tidak-ada")).toBeUndefined();
  });
});
