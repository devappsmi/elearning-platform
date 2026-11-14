import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAdminAuthGuard } from "../admin-auth/guards/jwt-admin-auth.guard";
import { AdminInvitationsService } from "./admin-invitations.service";
import { CreateInvitationDto, ListInvitationsQueryDto } from "./dto/invitation.dto";
import { InvitationDto, InvitationListItemDto } from "./dto/invitation-view.dto";

const CSV_TEMPLATE = "nama,email,kelas\nContoh Nama,contoh@email.com,Nama Kelas Persis Seperti di Sistem\n";
const MAX_CSV_BYTES = 1_000_000; // 1MB -- lebih dari cukup untuk beberapa ribu baris

@ApiTags("Admin Invitations")
@ApiBearerAuth("admin-access-token")
@Controller("admin/invitations")
@UseGuards(JwtAdminAuthGuard)
export class AdminInvitationsController {
  constructor(private readonly invitations: AdminInvitationsService) {}

  // Sebelum route ":id/..." supaya "template" tidak ketangkep sebagai :id.
  @Get("template")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="template-undangan.csv"')
  downloadTemplate(): string {
    return CSV_TEMPLATE;
  }

  @Post()
  createSingle(@Body() dto: CreateInvitationDto): Promise<InvitationDto> {
    return this.invitations.createSingle(dto);
  }

  @Post("bulk")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_CSV_BYTES } }))
  createBulk(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("File CSV wajib diupload (multipart field 'file')");
    return this.invitations.createBulk(file.buffer);
  }

  @Get()
  list(@Query() query: ListInvitationsQueryDto): Promise<InvitationListItemDto[]> {
    return this.invitations.list(query);
  }

  @Post(":id/resend")
  resend(@Param("id") id: string): Promise<InvitationDto> {
    return this.invitations.resend(id);
  }

  @Delete(":id")
  revoke(@Param("id") id: string): Promise<InvitationDto> {
    return this.invitations.revoke(id);
  }
}
