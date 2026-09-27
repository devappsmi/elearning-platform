import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { UsersService } from "./users.service";
import { UpdateMeDto } from "./dto/update-me.dto";

@Controller()
@UseGuards(JwtStudentAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  me(@CurrentUser() userId: string) {
    return this.users.findByIdOrThrow(userId);
  }

  @Patch("me")
  updateMe(@CurrentUser() userId: string, @Body() dto: UpdateMeDto) {
    return this.users.update(userId, dto);
  }
}
