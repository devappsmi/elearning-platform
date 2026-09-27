import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateClassDto {
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
