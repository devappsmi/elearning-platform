import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  type ValidationPipeOptions,
} from "@nestjs/common";
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

/** Opsi pipe validasi controller ini -- diekspor supaya tes DTO memakai
 * konfigurasi yang SAMA persis dengan yang berjalan di runtime.
 * `forbidNonWhitelisted` sengaja: endpoint baru, tidak ada client lama yang
 * perlu dijaga, dan field tak dikenal lebih baik ditolak daripada diam-diam
 * dibuang. */
export const TUTOR_VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = { whitelist: true, forbidNonWhitelisted: true, transform: true };

/** AI tutor (Milestone 11, lihat docs/PLAN.md bagian 6).
 *
 * `ValidationPipe` dipasang DI SINI (bukan cuma mengandalkan yang global)
 * karena API ini SAAT INI tidak mendaftarkan `ValidationPipe` global sama
 * sekali (main.ts/app.module.ts) -- tanpa pipe, dekorator class-validator di
 * DTO cuma hiasan dan batas panjang riwayat/teks (pengaman biaya token)
 * tidak pernah ditegakkan. Temuan itu (yang juga menyangkut DTO modul lain)
 * dicatat di docs/PLAN.md, tidak diubah diam-diam di sini. */
@ApiTags("Tutor")
@ApiBearerAuth("access-token")
@Controller("tutor")
@UseGuards(JwtStudentAuthGuard)
@UsePipes(new ValidationPipe(TUTOR_VALIDATION_PIPE_OPTIONS))
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
