import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAdminAuthGuard } from "../admin-auth/guards/jwt-admin-auth.guard";
import { AdminDashboardService } from "./admin-dashboard.service";

@Controller("admin/dashboard")
@UseGuards(JwtAdminAuthGuard)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  summary() {
    return this.dashboard.summary();
  }
}
