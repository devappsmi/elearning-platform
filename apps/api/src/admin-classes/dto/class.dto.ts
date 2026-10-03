import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { Trim } from "../../common/trim.decorator";

export class CreateClassDto {
  @Trim()
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  targetLevelId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateClassDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  targetLevelId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ListClassesQueryDto {
  @IsOptional()
  @IsIn(["ACTIVE", "ARCHIVED"])
  status?: "ACTIVE" | "ARCHIVED";
}
