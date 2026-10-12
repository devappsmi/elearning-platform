import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GamificationModule } from "../gamification/gamification.module";
import { LearningPathController } from "./learning-path.controller";
import { LearningPathService } from "./learning-path.service";

@Module({
  imports: [AuthModule, GamificationModule],
  controllers: [LearningPathController],
  providers: [LearningPathService],
})
export class LearningPathModule {}
