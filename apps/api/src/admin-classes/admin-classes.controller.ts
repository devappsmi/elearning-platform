import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAdminAuthGuard } from "../admin-auth/guards/jwt-admin-auth.guard";
import { AdminClassesService } from "./admin-classes.service";
import { CreateClassDto, ListClassesQueryDto, UpdateClassDto } from "./dto/class.dto";
import { ClassDetailDto, ClassDto, ClassListItemDto, ClassWithLevelDto } from "./dto/class-view.dto";

// ADM-02: owner & staff sama-sama punya akses penuh CRUD kelas (bukan cuma
// staff terkecuali kelola-admin/branding) -- tidak ada @Roles() di sini.
@ApiTags("Admin Classes")
@ApiBearerAuth("admin-access-token")
@Controller("admin/classes")
@UseGuards(JwtAdminAuthGuard)
export class AdminClassesController {
  constructor(private readonly classes: AdminClassesService) {}

  @Post()
  create(@Body() dto: CreateClassDto): Promise<ClassWithLevelDto> {
    return this.classes.create(dto);
  }

  @Get()
  list(@Query() query: ListClassesQueryDto): Promise<ClassListItemDto[]> {
    return this.classes.list(query);
  }

  @Get(":id")
  detail(@Param("id") id: string): Promise<ClassDetailDto> {
    return this.classes.detail(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateClassDto): Promise<ClassWithLevelDto> {
    return this.classes.update(id, dto);
  }

  @Patch(":id/archive")
  archive(@Param("id") id: string): Promise<ClassDto> {
    return this.classes.archive(id);
  }

  @Patch(":id/unarchive")
  unarchive(@Param("id") id: string): Promise<ClassDto> {
    return this.classes.unarchive(id);
  }
}
