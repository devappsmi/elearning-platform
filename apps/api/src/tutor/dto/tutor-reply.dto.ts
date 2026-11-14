import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { TutorQuotaDto } from "./tutor-quota.dto";

// Batas di bawah ini menahan biaya token per panggilan (riwayat + kosakata
// ikut masuk prompt berbayar), bukan sekadar kerapian input.
export const MAX_HISTORY_TURNS = 40;
export const MAX_TURN_CHARS = 500;
export const MAX_VOCAB_ITEMS = 30;
export const MAX_VOCAB_CHARS = 40;

export class TutorTurnDto {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TURN_CHARS)
  text!: string;
}

export class TutorReplyRequestDto {
  @IsString()
  @MinLength(1)
  scenarioId!: string;

  /** Default `yuki`. */
  @IsOptional()
  @IsString()
  characterId?: string;

  /** Urutan kronologis; giliran TERAKHIR harus dari murid (`user`). */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_HISTORY_TURNS)
  @ValidateNested({ each: true })
  @Type(() => TutorTurnDto)
  history!: TutorTurnDto[];

  /** Kosakata target yang diusahakan dipakai AI secara natural. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VOCAB_ITEMS)
  @IsString({ each: true })
  @MaxLength(MAX_VOCAB_CHARS, { each: true })
  vocab?: string[];

  /** `help` = murid minta bantuan: AI berhenti roleplay dan memberi 2-3
   * contoh kalimat + arti Indonesia. Default `roleplay`. */
  @IsOptional()
  @IsIn(["roleplay", "help"])
  mode?: "roleplay" | "help";
}

export class TutorReplyResponseDto {
  reply!: string;
  /** Kuota SESUDAH balasan ini dihitung. */
  quota!: TutorQuotaDto;
}
