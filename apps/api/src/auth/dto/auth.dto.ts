import { IsEmail, IsString, Matches, MinLength } from "class-validator";

export class ValidateInvitationDto {
  @IsString()
  token!: string;
}

export class RegisterDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  // AC AUTH-02: min. 8 karakter, huruf+angka
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: "Password harus mengandung huruf dan angka" })
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: "Password harus mengandung huruf dan angka" })
  password!: string;
}

export class RequestInvitationResendDto {
  @IsString()
  token!: string;
}
