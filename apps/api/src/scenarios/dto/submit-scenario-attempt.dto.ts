import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, Min, ValidateNested } from "class-validator";

export class ScenarioAnswerEventDto {
  @IsInt()
  @Min(0)
  lineIndex!: number;

  @IsInt()
  @Min(0)
  optionIndex!: number;
}

export class SubmitScenarioAttemptDto {
  @IsIn(["PRACTICE", "TEST"])
  mode!: "PRACTICE" | "TEST";

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScenarioAnswerEventDto)
  events!: ScenarioAnswerEventDto[];

  @IsInt()
  @Min(0)
  durationSec!: number;
}
