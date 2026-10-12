import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";
}

export class ListStudentsQueryDto {
  @IsOptional()
  @IsString()
  classId?: string;
}
