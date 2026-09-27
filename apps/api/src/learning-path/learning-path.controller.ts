import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { LearningPathService } from "./learning-path.service";

@ApiTags("Learning Path")
@ApiBearerAuth("access-token")
@Controller()
@UseGuards(JwtStudentAuthGuard)
export class LearningPathController {
  constructor(private readonly learningPath: LearningPathService) {}

  @Get("path")
  getPath(@CurrentUser() userId: string) {
    return this.learningPath.getPath(userId);
  }
}
