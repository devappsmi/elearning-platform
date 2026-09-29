import { IsEmail, IsString } from "class-validator";
import { NormalizeEmail } from "../../common/normalize-email.decorator";

export class AdminLoginDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class AdminRefreshDto {
  @IsString()
  refreshToken!: string;
}
