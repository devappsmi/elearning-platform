import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ContentModule } from "../content/content.module";
import { GamificationModule } from "../gamification/gamification.module";
import { SrsModule } from "../srs/srs.module";
import { LessonsController } from "./lessons.controller";
import { LessonsService } from "./lessons.service";

@Module({
  imports: [AuthModule, ContentModule, GamificationModule, SrsModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
