import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ContentModule } from "../content/content.module";
import { PlacementController } from "./placement.controller";
import { PlacementService } from "./placement.service";

@Module({
  imports: [AuthModule, ContentModule],
  controllers: [PlacementController],
  providers: [PlacementService],
})
export class PlacementModule {}
