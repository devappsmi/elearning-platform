import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { GamificationService } from "./gamification.service";

@Controller()
@UseGuards(JwtStudentAuthGuard)
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get("leaderboard")
  leaderboard(@CurrentUser() userId: string) {
    return this.gamification.classLeaderboard(userId);
  }
}
