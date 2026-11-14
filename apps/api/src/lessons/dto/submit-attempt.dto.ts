import { Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from "class-validator";

/** Satu event submit dari LessonSession client (bukan cuma jawaban akhir --
 * item yang sempat salah lalu diulang muncul lagi sebagai event terpisah,
 * lihat catatan di lessons.service.ts). `ref` dipakai server untuk
 * memastikan urutan event ini benar-benar valid replay dari LessonSession
 * atas lesson ini (lihat assertion di LessonsService.submitAttempt) --
 * grading sendiri berdasarkan `choiceText`/`tokens` (NILAI yang dipilih),
 * bukan index opsi (index bisa beda antara shuffle client dan server). */
export class AnswerEventDto {
  @IsString()
  ref!: string;

  @IsIn(["choose", "assemble"])
  kind!: "choose" | "assemble";

  @IsOptional()
  @IsString()
  choiceText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tokens?: string[];
}

export class SubmitAttemptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerEventDto)
  answers!: AnswerEventDto[];
}
