import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { ScenariosService } from "./scenarios.service";
import { SubmitScenarioAttemptDto } from "./dto/submit-scenario-attempt.dto";
import { ScenarioSummaryDto } from "./dto/scenario-summary.dto";
import { ScenarioAttemptResultDto } from "./dto/scenario-attempt-result.dto";

@ApiTags("Scenarios")
@ApiBearerAuth("access-token")
@Controller("scenarios")
@UseGuards(JwtStudentAuthGuard)
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  list(): Promise<ScenarioSummaryDto[]> {
    return this.scenarios.list();
  }

  // SENGAJA tidak dianotasi tipe balik -- sama keputusan dengan
  // LessonsController.getLesson (lihat catatan di lessons.controller.ts /
  // learning-path/dto/path-view.dto.ts): respons ini membawa
  // `content: ScenarioContent`, tipe framework-agnostic milik
  // `packages/domain` (dipakai luas oleh `ScenarioSession`), bukan cuma
  // bentuk lokal endpoint ini. Mengubahnya jadi DTO Swagger akan
  // membocorkan concern dokumentasi API ke paket yang sengaja bebas
  // dependency NestJS. Frontend mengonsumsi lewat cast manual.
  @Get(":id")
  detail(@Param("id") id: string) {
    return this.scenarios.detail(id);
  }

  @Post(":id/attempts")
  submitAttempt(
    @CurrentUser() userId: string,
    @Param("id") id: string,
    @Body() dto: SubmitScenarioAttemptDto,
  ): Promise<ScenarioAttemptResultDto> {
    return this.scenarios.submitAttempt(userId, id, dto.mode, dto.events, dto.durationSec);
  }
}
