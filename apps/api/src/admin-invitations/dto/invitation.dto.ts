import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { NormalizeEmail } from "../../common/normalize-email.decorator";
import { Trim } from "../../common/trim.decorator";

export class CreateInvitationDto {
  @Trim()
  @IsString()
  @MinLength(1)
  name!: string;

  @NormalizeEmail()
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
