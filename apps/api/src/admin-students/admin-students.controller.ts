import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAdminAuthGuard } from "../admin-auth/guards/jwt-admin-auth.guard";
import { AdminStudentsService } from "./admin-students.service";
import { ListStudentsQueryDto, UpdateStudentDto } from "./dto/update-student.dto";
import { ResetPasswordResponseDto, StudentDetailDto, StudentListItemDto, StudentProgressDto } from "./dto/student-view.dto";

@ApiTags("Admin Students")
@ApiBearerAuth("admin-access-token")
@Controller("admin/students")
@UseGuards(JwtAdminAuthGuard)
export class AdminStudentsController {
  constructor(private readonly students: AdminStudentsService) {}

  @Get()
  list(@Query() query: ListStudentsQueryDto): Promise<StudentListItemDto[]> {
    return this.students.list(query);
  }

  @Get(":id")
  detail(@Param("id") id: string): Promise<StudentDetailDto> {
    return this.students.detail(id);
  }

  @Get(":id/progress")
  progress(@Param("id") id: string): Promise<StudentProgressDto> {
    return this.students.progress(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateStudentDto): Promise<StudentDetailDto> {
    return this.students.update(id, dto);
  }

  @Post(":id/reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Param("id") id: string): Promise<ResetPasswordResponseDto> {
    await this.students.triggerPasswordReset(id);
    return { message: "Email reset password sudah dikirim ke murid." };
  }
}
