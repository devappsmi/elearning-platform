import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAdminAuthGuard } from "../admin-auth/guards/jwt-admin-auth.guard";
import { AdminClassesService } from "./admin-classes.service";
import { CreateClassDto, ListClassesQueryDto, UpdateClassDto } from "./dto/class.dto";

// ADM-02: owner & staff sama-sama punya akses penuh CRUD kelas (bukan cuma
// staff terkecuali kelola-admin/branding) -- tidak ada @Roles() di sini.
@Controller("admin/classes")
@UseGuards(JwtAdminAuthGuard)
export class AdminClassesController {
  constructor(private readonly classes: AdminClassesService) {}

  @Post()
  create(@Body() dto: CreateClassDto) {
    return this.classes.create(dto);
  }

  @Get()
  list(@Query() query: ListClassesQueryDto) {
    return this.classes.list(query);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.classes.detail(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateClassDto) {
    return this.classes.update(id, dto);
  }

  @Patch(":id/archive")
  archive(@Param("id") id: string) {
    return this.classes.archive(id);
  }

  @Patch(":id/unarchive")
  unarchive(@Param("id") id: string) {
    return this.classes.unarchive(id);
  }
}
