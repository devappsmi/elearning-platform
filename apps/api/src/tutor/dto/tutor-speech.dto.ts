import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const MAX_SPEAK_CHARS = 500;

export class TutorTranscribeResponseDto {
  /** Hasil transkripsi (bahasa dipatok Jepang). Bisa kosong kalau rekaman
   * hening. */
  text!: string;
}

export class TutorSpeakRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SPEAK_CHARS)
  text!: string;

  /** Menentukan voice + gaya bicara. Kosong = voice bawaan server
   * (OPENAI_TTS_VOICE_DEFAULT) tanpa instruksi gaya. */
  @IsOptional()
  @IsString()
  characterId?: string;
}

export class TutorSpeakResponseDto {
  /** URL mp3 -- di-cache berdasarkan hash (teks + setelan suara), teks yang
   * sama tidak pernah disintesis dua kali. */
  audioUrl!: string;
}
