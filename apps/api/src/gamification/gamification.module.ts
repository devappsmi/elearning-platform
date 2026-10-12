import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GamificationController } from "./gamification.controller";
import { GamificationService } from "./gamification.service";

@Module({
  imports: [AuthModule], // butuh JwtStudentAuthGuard's strategy terdaftar
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
