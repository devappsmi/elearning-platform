import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { PlacementAttemptResultView, PlacementStatusView, PlacementTestView, SubmitPlacementDto } from "./dto/placement.dto";
import { PlacementService } from "./placement.service";

@ApiTags("Placement")
@ApiBearerAuth("access-token")
@Controller("placement")
@UseGuards(JwtStudentAuthGuard)
export class PlacementController {
  constructor(private readonly placement: PlacementService) {}

  @Get()
  status(@CurrentUser() userId: string): Promise<PlacementStatusView> {
    return this.placement.status(userId);
  }

  /** Membuat soal baru (mengganti tes yang belum dikirim). */
  @Post("tests")
  createTest(@CurrentUser() userId: string): Promise<PlacementTestView> {
    return this.placement.createTest(userId);
  }

  @Post("attempts")
  submit(@CurrentUser() userId: string, @Body() dto: SubmitPlacementDto): Promise<PlacementAttemptResultView> {
    return this.placement.submit(userId, dto);
  }
}
