import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { LessonsService } from "./lessons.service";
import { SubmitAttemptDto } from "./dto/submit-attempt.dto";

@ApiTags("Lessons")
@ApiBearerAuth("access-token")
@Controller("lessons")
@UseGuards(JwtStudentAuthGuard)
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get(":id")
  getLesson(@Param("id") id: string) {
    return this.lessons.getLessonContent(id);
  }

  @Post(":id/attempts")
  submitAttempt(@CurrentUser() userId: string, @Param("id") id: string, @Body() dto: SubmitAttemptDto) {
    return this.lessons.submitAttempt(userId, id, dto.answers);
  }
}
