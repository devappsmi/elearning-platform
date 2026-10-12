import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { UsersService } from "./users.service";
import { MeDto } from "./dto/me.dto";
import { UpdateMeDto } from "./dto/update-me.dto";

@ApiTags("Users")
@ApiBearerAuth("access-token")
@Controller()
@UseGuards(JwtStudentAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  me(@CurrentUser() userId: string): Promise<MeDto> {
    return this.users.findByIdOrThrow(userId);
  }

  @Patch("me")
  updateMe(@CurrentUser() userId: string, @Body() dto: UpdateMeDto): Promise<MeDto> {
    return this.users.update(userId, dto);
  }
}
