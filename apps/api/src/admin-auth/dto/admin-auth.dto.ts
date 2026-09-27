import { IsEmail, IsString } from "class-validator";

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class AdminRefreshDto {
  @IsString()
  refreshToken!: string;
}
