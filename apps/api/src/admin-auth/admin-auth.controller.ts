import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { AdminAuthService } from "./admin-auth.service";
import { AdminLoginDto, AdminRefreshDto } from "./dto/admin-auth.dto";

@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuth.login(dto.email, dto.password);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: AdminRefreshDto) {
    return this.adminAuth.refresh(dto.refreshToken);
  }
}
