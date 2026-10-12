import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { AudioService } from "../audio/audio.service";
import { DEFAULT_TUTOR_CHARACTER_ID, TUTOR_CHARACTERS, TUTOR_SCENARIOS, findTutorCharacter, findTutorScenario } from "./tutor.const";
import { buildTutorInstructions, flattenHistory } from "./tutor-prompt";
import { TutorQuota, type TutorQuotaStatus } from "./tutor-quota";
import { TutorLlmClient } from "./tutor-llm.client";
import { SpeechToTextClient } from "./tutor-stt.client";
import { TutorTtsClient } from "./tutor-tts.client";
import { audioFilenameFor, normalizeMime } from "./tutor-audio.util";
import type { TutorCatalogDto } from "./dto/tutor-catalog.dto";
import type { TutorReplyRequestDto, TutorReplyResponseDto } from "./dto/tutor-reply.dto";
import type { TutorSpeakRequestDto, TutorSpeakResponseDto, TutorTranscribeResponseDto } from "./dto/tutor-speech.dto";

const NOT_CONFIGURED_MESSAGE = "AI tutor belum dikonfigurasi di server ini.";

/** Bagian minimal dari `Express.Multer.File` yang dibutuhkan -- service tidak
 * perlu tahu soal Multer/Express. */
export interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** AI tutor (Milestone 11) -- port dari `server/ai_tutor` (FastAPI) lama, lihat
 * docs/PLAN.md bagian 6. Orkestrasi saja: kuota (Redis, atomik), prompt
 * (fungsi murni), dan tiga provider di balik seam (LLM/STT/TTS).
 *
 * Urutan di `reply` penting dan disengaja:
 * 1. validasi input -> 400 (tidak menyentuh kuota),
 * 2. cek kredensial -> 503 (SEBELUM kuota -- server yang salah konfigurasi
 *    tidak boleh diam-diam menghabiskan jatah murid tanpa panggilan API
 *    sungguhan, persis catatan versi lama),
 * 3. ambil jatah (atomik) -> 429 kalau habis,
 * 4. panggil LLM; kalau gagal jatah DIKEMBALIKAN (murid tidak rugi karena
 *    gangguan di sisi kita/provider) -> 502. Pengembalian ini keputusan
 *    baru, bukan port -- spesifikasi lama tidak mencatat perilakunya. */
@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(
    private readonly quota: TutorQuota,
    private readonly llm: TutorLlmClient,
    private readonly stt: SpeechToTextClient,
    private readonly tts: TutorTtsClient,
    private readonly audio: AudioService,
  ) {}

  catalog(): TutorCatalogDto {
    return {
      scenarios: TUTOR_SCENARIOS.map(({ id, title, description }) => ({ id, title, description })),
      characters: TUTOR_CHARACTERS.map(({ id, name, personality }) => ({ id, name, personality })),
    };
  }

  quotaStatus(userId: string): Promise<TutorQuotaStatus> {
    return this.quota.status(userId, new Date());
  }

  async reply(userId: string, dto: TutorReplyRequestDto): Promise<TutorReplyResponseDto> {
    const scenario = findTutorScenario(dto.scenarioId);
    if (!scenario) throw new BadRequestException(`Skenario tidak dikenal: ${dto.scenarioId}`);
    const characterId = dto.characterId ?? DEFAULT_TUTOR_CHARACTER_ID;
    const character = findTutorCharacter(characterId);
    if (!character) throw new BadRequestException(`Karakter tidak dikenal: ${characterId}`);
    if (dto.history.at(-1)?.role !== "user") {
      throw new BadRequestException("Giliran terakhir riwayat harus dari murid (role 'user')");
    }

    if (!this.llm.configured) throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);

    const instructions = buildTutorInstructions({ scenario, character, vocab: dto.vocab, mode: dto.mode ?? "roleplay" });
    const input = flattenHistory(dto.history);

    // `now` ditangkap SEKALI dan dipakai juga oleh refund -- kalau panggilan
    // LLM melewati tengah malam, pengembalian tetap mengenai counter hari
    // tempat jatah itu diambil.
    const now = new Date();
    const quota = await this.quota.consume(userId, now);
    if (!quota) {
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: "Kuota harian AI tutor habis.", quota: await this.quota.status(userId, now) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let reply: string;
    try {
      reply = await this.llm.reply({ instructions, input });
    } catch (error) {
      await this.refundQuietly(userId, now);
      this.logUpstreamFailure("reply", error);
      throw new BadGatewayException("Layanan AI sedang bermasalah, coba lagi sebentar. Jatahmu tidak terpotong.");
    }
    return { reply, quota };
  }

  async transcribe(file: UploadedAudio | undefined): Promise<TutorTranscribeResponseDto> {
    if (!file || file.size === 0) throw new BadRequestException("File audio wajib diupload (multipart field 'file')");
    const filename = audioFilenameFor(file.mimetype);
    if (!filename) throw new UnsupportedMediaTypeException(`Format audio tidak didukung: ${file.mimetype}`);
    if (!this.stt.configured) throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);

    try {
      const text = await this.stt.transcribe({ audio: file.buffer, filename, mimetype: normalizeMime(file.mimetype) });
      return { text };
    } catch (error) {
      this.logUpstreamFailure("transcribe", error);
      throw new BadGatewayException("Gagal mentranskripsi rekaman, coba lagi sebentar.");
    }
  }

  async speak(dto: TutorSpeakRequestDto): Promise<TutorSpeakResponseDto> {
    const text = dto.text.trim();
    if (!text) throw new BadRequestException("Teks tidak boleh kosong");

    let voice = this.tts.defaultVoice;
    let instructions: string | undefined;
    if (dto.characterId !== undefined) {
      const character = findTutorCharacter(dto.characterId);
      if (!character) throw new BadRequestException(`Karakter tidak dikenal: ${dto.characterId}`);
      voice = character.voice;
      instructions = character.voiceInstructions;
    }

    if (!this.tts.configured) throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);

    try {
      // Jalur cache SAMA dengan audio konten lesson/kamus/skenario -- teks +
      // setelan suara yang sama tidak pernah disintesis (dan dibayar) dua kali.
      const audioUrl = await this.audio.resolveAudioUrlWith(text, this.tts.voiceKey(voice, instructions), () =>
        this.tts.synthesize({ text, voice, instructions }),
      );
      return { audioUrl };
    } catch (error) {
      this.logUpstreamFailure("speak", error);
      throw new BadGatewayException("Gagal membuat audio, coba lagi sebentar.");
    }
  }

  private async refundQuietly(userId: string, now: Date): Promise<void> {
    try {
      await this.quota.refund(userId, now);
    } catch (error) {
      // Gagal mengembalikan jatah tidak boleh menutupi error asli ke client.
      this.logger.error(`Gagal mengembalikan jatah tutor: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Detail error provider cuma masuk log server, TIDAK ke client. Isi
   * percakapan murid sengaja tidak ikut dicatat. */
  private logUpstreamFailure(operation: string, error: unknown): void {
    const status = typeof error === "object" && error !== null && "status" in error ? String((error as { status?: unknown }).status) : undefined;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Tutor ${operation} gagal${status ? ` (status ${status})` : ""}: ${message}`);
  }
}
