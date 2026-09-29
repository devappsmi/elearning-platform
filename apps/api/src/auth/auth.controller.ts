import { Body, Controller, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { MessageResponseDto } from "../common/dto/message-response.dto";
import { TokenPairDto } from "../common/dto/token-pair.dto";
import { AuthService } from "./auth.service";
import { InvitationCheckDto } from "./dto/invitation-check.dto";
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  ValidateInvitationDto,
} from "./dto/auth.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("invitations/validate")
  @HttpCode(HttpStatus.OK)
  validateInvitation(@Body() dto: ValidateInvitationDto): Promise<InvitationCheckDto> {
    return this.auth.validateInvitation(dto.token);
  }

  @Post("register")
  register(@Body() dto: RegisterDto): Promise<TokenPairDto> {
    return this.auth.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<TokenPairDto> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<TokenPairDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("forgot")
  @HttpCode(HttpStatus.OK)
  async forgot(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    await this.auth.forgotPassword(dto.email);
    return { message: "Kalau email terdaftar, link reset sudah dikirim." };
  }

  @Post("reset")
  @HttpCode(HttpStatus.OK)
  async reset(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    await this.auth.resetPassword(dto.token, dto.password);
    return { message: "Password berhasil diubah." };
  }

  // AUTH-02 AC: tombol "Minta undangan ulang" pada token invalid/kedaluwarsa.
  // Rate-limited lebih ketat dari default (3/jam) -- endpoint ini memicu
  // email ke semua admin, jangan sampai jadi vektor spam.
  @Post("invitations/:token/request-resend")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  async requestResend(@Param("token") token: string): Promise<MessageResponseDto> {
    await this.auth.requestInvitationResend(token);
    return { message: "Permintaan sudah diteruskan ke admin." };
  }
}
