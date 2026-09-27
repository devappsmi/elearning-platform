import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { JwtAdminStrategy } from "./strategies/jwt-admin.strategy";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, JwtAdminStrategy],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
