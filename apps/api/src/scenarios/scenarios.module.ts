import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GamificationModule } from "../gamification/gamification.module";
import { ScenariosController } from "./scenarios.controller";
import { ScenariosService } from "./scenarios.service";

@Module({
  imports: [AuthModule, GamificationModule],
  controllers: [ScenariosController],
  providers: [ScenariosService],
})
export class ScenariosModule {}
