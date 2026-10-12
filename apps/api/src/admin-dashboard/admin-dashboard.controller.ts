import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAdminAuthGuard } from "../admin-auth/guards/jwt-admin-auth.guard";
import { AdminDashboardService } from "./admin-dashboard.service";
import { DashboardSummaryDto } from "./dto/dashboard-summary.dto";

@ApiTags("Admin Dashboard")
@ApiBearerAuth("admin-access-token")
@Controller("admin/dashboard")
@UseGuards(JwtAdminAuthGuard)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  summary(): Promise<DashboardSummaryDto> {
    return this.dashboard.summary();
  }
}
