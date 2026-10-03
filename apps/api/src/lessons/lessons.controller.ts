import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { LessonsService } from "./lessons.service";
import { AttemptResultView } from "./dto/attempt-result.dto";
import { SubmitAttemptDto } from "./dto/submit-attempt.dto";

@ApiTags("Lessons")
@ApiBearerAuth("access-token")
@Controller("lessons")
@UseGuards(JwtStudentAuthGuard)
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  // Response TIDAK dianotasi tipe balik eksplisit -- SENGAJA (beda dari
  // submitAttempt di bawah): bentuknya {unit, lesson} dari @elearning/domain
  // (Unit/Lesson di content/types.ts), interface framework-agnostic yang
  // dipakai luas di packages/domain (ExerciseFactory/LessonSession/dst).
  // Mengubahnya jadi class cuma demi skema Swagger endpoint ini akan
  // membocorkan concern dokumentasi API ke paket yang sengaja bebas
  // dependency NestJS. Frontend (apps/student) konsumsi lewat cast manual
  // ke tipe @elearning/domain, lihat catatan di api-client.ts/LessonPage.
  @Get(":id")
  getLesson(@Param("id") id: string) {
    return this.lessons.getLessonContent(id);
  }

  @Post(":id/attempts")
  submitAttempt(
    @CurrentUser() userId: string,
    @Param("id") id: string,
    @Body() dto: SubmitAttemptDto,
  ): Promise<AttemptResultView> {
    return this.lessons.submitAttempt(userId, id, dto.answers);
  }
}
