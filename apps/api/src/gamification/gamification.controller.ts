import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { GamificationService } from "./gamification.service";
import { LeaderboardResponseDto } from "./dto/leaderboard-view.dto";

@ApiTags("Gamification")
@ApiBearerAuth("access-token")
@Controller()
@UseGuards(JwtStudentAuthGuard)
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get("leaderboard")
  leaderboard(@CurrentUser() userId: string): Promise<LeaderboardResponseDto> {
    return this.gamification.classLeaderboard(userId);
  }
}
