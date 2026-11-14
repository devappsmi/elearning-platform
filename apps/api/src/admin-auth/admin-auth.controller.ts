import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentAdmin } from "../common/current-admin.decorator";
import { TokenPairDto } from "../common/dto/token-pair.dto";
import { AdminAuthService } from "./admin-auth.service";
import { AdminLoginDto, AdminRefreshDto } from "./dto/admin-auth.dto";
import { MeAdminDto } from "./dto/me-admin.dto";
import { JwtAdminAuthGuard } from "./guards/jwt-admin-auth.guard";

@ApiTags("Admin Auth")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AdminLoginDto): Promise<TokenPairDto> {
    return this.adminAuth.login(dto.email, dto.password);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: AdminRefreshDto): Promise<TokenPairDto> {
    return this.adminAuth.refresh(dto.refreshToken);
  }

  // Padanan GET /me sisi murid (UsersController) -- BELUM ada sebelum
  // Milestone 10 lanjutan karena belum ada consumer (frontend admin masih
  // stub). Dibutuhkan sekarang supaya AuthGuard apps/admin bisa memvalidasi
  // token ke server sungguhan (bukan cuma cek localStorage) + tahu nama
  // admin yang login, persis pola apps/student -- lihat docs/PLAN.md.
  @Get("me")
  @UseGuards(JwtAdminAuthGuard)
  @ApiBearerAuth("admin-access-token")
  me(@CurrentAdmin() admin: { adminUserId: string }): Promise<MeAdminDto> {
    return this.adminAuth.me(admin.adminUserId);
  }
}
