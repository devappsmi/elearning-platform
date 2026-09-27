import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateInvitationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  classId!: string;
}

export class ListInvitationsQueryDto {
  @IsOptional()
  @IsIn(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"])
  status?: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

  @IsOptional()
  @IsString()
  classId?: string;
}
