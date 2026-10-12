import { Module } from "@nestjs/common";
import { AdminAuthModule } from "../admin-auth/admin-auth.module";
import { AdminClassesController } from "./admin-classes.controller";
import { AdminClassesService } from "./admin-classes.service";

@Module({
  imports: [AdminAuthModule], // butuh JwtAdminAuthGuard's strategy terdaftar
  controllers: [AdminClassesController],
  providers: [AdminClassesService],
  exports: [AdminClassesService],
})
export class AdminClassesModule {}
