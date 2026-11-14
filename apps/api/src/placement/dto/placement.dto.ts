import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import type { PlacementQuestionKind } from "@elearning/domain";

/** Bentuk request/respons /placement (PRD AUTH-05). Soal yang dikirim ke murid sengaja TANPA kunci jawaban
 * (tidak ada correctIndex/refId -- refId kosakata huruf seperti `k_shi` sudah membocorkan jawabannya); kuncinya
 * disimpan di server (lihat placement.service.ts). `kind` butuh `@ApiProperty({enum})` manual: union literal, bukan
 * enum, tidak bisa disimpulkan plugin CLI (catatan yang sama di learning-path/dto/path-view.dto.ts). */

export class PlacementUnitView {
  id!: string;
  title!: string;
  levelName!: string;
}

export class PlacementOutcomeView {
  takenAt!: Date;
  correct!: number;
  total!: number;
  /** Unit tempat murid mulai (unit pertama jalur bila tidak ada yang dilewati); null hanya bila jalurnya kosong. */
  startUnit!: PlacementUnitView | null;
  /** Unit sebelum `startUnit` yang dilewati berkat tes; tetap bisa dipelajari kapan saja. */
  skippedUnits!: PlacementUnitView[];
}

export class PlacementStatusView {
  /** Fitur dinyalakan (env PLACEMENT_TEST_ENABLED). */
  enabled!: boolean;
  /** Murid ini boleh ikut tes sekarang: fitur menyala, ada unit yang bisa dilewati, belum pernah ikut, dan belum
   * menyelesaikan satu pelajaran pun. */
  available!: boolean;
  questionCount!: number;
  passPercent!: number;
  /** Unit yang bisa dilewati lewat tes ini, urut jalur (kosong bila tidak ada). */
  sections!: PlacementUnitView[];
  /** Hasil tes yang sudah diambil; null bila belum pernah. */
  result!: PlacementOutcomeView | null;
}

export class PlacementChoiceView {
  text!: string;
  sub?: string;
}

export class PlacementQuestionView {
  id!: string;
  sectionUnitId!: string;
  @ApiProperty({ enum: ["kana_to_romaji", "romaji_to_kana", "word_meaning"] })
  kind!: PlacementQuestionKind;
  prompt!: string;
  promptSub?: string;
  options!: PlacementChoiceView[];
}

export class PlacementTestSectionView {
  unitId!: string;
  title!: string;
  questionCount!: number;
}

export class PlacementTestView {
  testId!: string;
  expiresAt!: Date;
  passPercent!: number;
  sections!: PlacementTestSectionView[];
  questions!: PlacementQuestionView[];
}

export class PlacementSectionResultView {
  unitId!: string;
  title!: string;
  correct!: number;
  total!: number;
  passed!: boolean;
}

export class PlacementAttemptResultView extends PlacementOutcomeView {
  passPercent!: number;
  sections!: PlacementSectionResultView[];
}

export class PlacementAnswerDto {
  /** Teks opsi yang dipilih; null/kosong = "Belum tahu" (dinilai salah). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  choiceText?: string | null;
}

export class SubmitPlacementDto {
  @IsUUID()
  testId!: string;

  /** Satu jawaban per soal, urut sama dengan `questions` di PlacementTestView. */
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PlacementAnswerDto)
  answers!: PlacementAnswerDto[];
}
