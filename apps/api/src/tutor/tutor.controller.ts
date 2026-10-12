import { Body, Controller, Get, HttpCode, HttpStatus, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { TutorService } from "./tutor.service";
import { MAX_TUTOR_AUDIO_BYTES } from "./tutor-audio.util";
import { TutorCatalogDto } from "./dto/tutor-catalog.dto";
import { TutorQuotaDto } from "./dto/tutor-quota.dto";
import { TutorReplyRequestDto, TutorReplyResponseDto } from "./dto/tutor-reply.dto";
import { TutorSpeakRequestDto, TutorSpeakResponseDto, TutorTranscribeResponseDto } from "./dto/tutor-speech.dto";

/** `/transcribe` dan `/speak` memanggil API berbayar tapi TIDAK punya kuota
 * harian (kuota versi lama cuma untuk balasan) -- dibatasi laju per menit
 * sebagai pengaman biaya. `/reply` sudah dibatasi kuota harian. */
const PAID_CALL_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

/** AI tutor (Milestone 11, lihat docs/PLAN.md bagian 6).
 *
 * Batas biaya di DTO tutor (riwayat 40 giliran, teks 500 karakter, dst.)
 * ditegakkan oleh `ValidationPipe` GLOBAL (`APP_PIPE` di AppModule, opsi di
 * common/validation.ts). Sebelumnya pipe ini dipasang lokal di sini karena
 * API belum punya yang global -- lihat docs/PLAN.md bagian 6e. */
@ApiTags("Tutor")
@ApiBearerAuth("access-token")
@Controller("tutor")
@UseGuards(JwtStudentAuthGuard)
export class TutorController {
  constructor(private readonly tutor: TutorService) {}

  @Get("scenarios")
  scenarios(): TutorCatalogDto {
    return this.tutor.catalog();
  }

  @Get("quota")
  quota(@CurrentUser() userId: string): Promise<TutorQuotaDto> {
    return this.tutor.quotaStatus(userId);
  }

  @Post("reply")
  @HttpCode(HttpStatus.OK)
  reply(@CurrentUser() userId: string, @Body() dto: TutorReplyRequestDto): Promise<TutorReplyResponseDto> {
    return this.tutor.reply(userId, dto);
  }

  @Post("transcribe")
  @HttpCode(HttpStatus.OK)
  @Throttle(PAID_CALL_THROTTLE)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_TUTOR_AUDIO_BYTES } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } })
  transcribe(@UploadedFile() file?: Express.Multer.File): Promise<TutorTranscribeResponseDto> {
    return this.tutor.transcribe(file);
  }

  @Post("speak")
  @HttpCode(HttpStatus.OK)
  @Throttle(PAID_CALL_THROTTLE)
  speak(@Body() dto: TutorSpeakRequestDto): Promise<TutorSpeakResponseDto> {
    return this.tutor.speak(dto);
  }
}
