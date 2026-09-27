import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { ScenariosService } from "./scenarios.service";
import { SubmitScenarioAttemptDto } from "./dto/submit-scenario-attempt.dto";

@Controller("scenarios")
@UseGuards(JwtStudentAuthGuard)
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  list() {
    return this.scenarios.list();
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.scenarios.detail(id);
  }

  @Post(":id/attempts")
  submitAttempt(@CurrentUser() userId: string, @Param("id") id: string, @Body() dto: SubmitScenarioAttemptDto) {
    return this.scenarios.submitAttempt(userId, id, dto.mode, dto.events, dto.durationSec);
  }
}
