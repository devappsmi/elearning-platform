import { IsBoolean, IsString } from "class-validator";

export class ReviewFlashcardDto {
  @IsString()
  itemId!: string;

  @IsBoolean()
  correct!: boolean;
}
