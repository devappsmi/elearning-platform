import { PASSWORD_LETTER_AND_DIGIT, PASSWORD_MIN_LENGTH } from "@elearning/domain";
import { IsEmail, IsString, Matches, MinLength } from "class-validator";
import { Trim } from "../../common/trim.decorator";

export class ValidateInvitationDto {
  @IsString()
  token!: string;
}

export class RegisterDto {
  @IsString()
  token!: string;

  @Trim()
  @IsString()
  @MinLength(1)
  name!: string;

  // AC AUTH-02: min. 8 karakter, huruf+angka -- aturannya dari @elearning/domain
  // (satu sumber dengan validasi klien di form murid), dipakai juga di ResetPasswordDto.
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(PASSWORD_LETTER_AND_DIGIT, { message: "Password harus mengandung huruf dan angka" })
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
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(PASSWORD_LETTER_AND_DIGIT, { message: "Password harus mengandung huruf dan angka" })
  password!: string;
}

export class RequestInvitationResendDto {
  @IsString()
  token!: string;
}
