import { IsString, MinLength } from "class-validator";

export class SearchDictionaryQueryDto {
  @IsString()
  @MinLength(1)
  q!: string;
}
