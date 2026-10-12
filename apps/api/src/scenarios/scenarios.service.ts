import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ScenarioSession, scenarioContentSchema, XpService, type ScenarioContent } from "@elearning/domain";
import { PrismaService } from "../prisma/prisma.service";
import { GamificationService } from "../gamification/gamification.service";
import { hashAudioKey } from "../audio/audio-hash.util";
import { loadAudioUrlsByHash, type AudioUrlByHash } from "../audio/audio-lookup.util";
import type { ScenarioAnswerEventDto } from "./dto/submit-scenario-attempt.dto";
import type { ScenarioSummaryDto } from "./dto/scenario-summary.dto";
import type { ScenarioAttemptResultDto } from "./dto/scenario-attempt-result.dto";

/** CONV-01..05. Payload `Scenario.payload` disimpan sebagai SATU blob JSON
 * (beda dari konten lesson yang didekomposisi jadi baris relasional Vocab/
 * Sentence/Exercise) -- jadi TIDAK seperti content.mapper.ts, di sini zod
 * (`scenarioContentSchema`) DIJALANKAN LAGI tiap baca, bukan cuma sekali di
 * seed. Itu keputusan sengaja: shape-nya jauh lebih kompleks/bernested
 * (lines[] campuran narration/choice) sebagai satu kolom Json, validasi
 * ulang murah dan menangkap korupsi data/schema-drift dengan pesan jelas,
 * bukan crash membingungkan jauh di dalam ScenarioSession. */
@Injectable()
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async list(): Promise<ScenarioSummaryDto[]> {
    const rows = await this.prisma.scenario.findMany({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "asc" } });
    return rows.map((row) => {
      const content = this.parseContent(row.id, row.payload);
      return { id: row.id, titleJp: row.titleJp, titleId: row.titleId, level: row.level, roles: content.roles, estimatedMinutes: content.estimatedMinutes };
    });
  }

  async detail(id: string): Promise<{ id: string; titleJp: string; titleId: string; level: string; content: ScenarioContent }> {
    const row = await this.getPublishedRow(id);
    const rawContent = this.parseContent(row.id, row.payload);
    const audioUrlByHash = await loadAudioUrlsByHash(this.prisma, collectAudioHashKeys(rawContent));
    return { id: row.id, titleJp: row.titleJp, titleId: row.titleId, level: row.level, content: enrichWithAudio(rawContent, audioUrlByHash) };
  }

  /** Server-authoritative, pola SAMA dengan LessonsService: replay log event
   * mentah client lewat ScenarioSession SENDIRI (konten direkonstruksi ulang
   * dari DB, bukan dipercaya dari request). BEDA dari lesson: opsi dialog
   * TIDAK PERNAH diacak (lihat catatan currentIndex di scenarioSession.ts),
   * jadi submit BY INDEX aman -- tidak perlu grading by-value seperti
   * choiceText lesson. */
  async submitAttempt(
    userId: string,
    scenarioId: string,
    mode: "PRACTICE" | "TEST",
    events: ScenarioAnswerEventDto[],
    durationSec: number,
  ): Promise<ScenarioAttemptResultDto> {
    const row = await this.getPublishedRow(scenarioId);
    const content = this.parseContent(row.id, row.payload);

    const session = new ScenarioSession({ scenario: content, mode: mode === "TEST" ? "test" : "practice" });
    let eventIndex = 0;

    while (!session.isFinished) {
      const line = session.current;
      if (line.kind === "narration") {
        session.next();
        continue;
      }

      const event = events[eventIndex++];
      if (!event) throw new BadRequestException("Jumlah jawaban kurang dari jumlah baris dialog yang perlu dijawab");
      if (event.lineIndex !== session.currentIndex) {
        throw new BadRequestException(
          `Urutan jawaban tidak valid (diharapkan baris ke-${session.currentIndex}, dapat ke-${event.lineIndex})`,
        );
      }
      session.submitChoice(event.optionIndex);
      session.next();
    }

    const result = session.result;
    const passed = result.accuracyPercent >= 80 && !result.failed;

    // CONV-04: "skor akhir = % respon benar + bonus waktu" -- formula bonus
    // waktu di bawah PROPOSAL sendiri, PRD tidak kasih angka sama sekali
    // untuk dibandingkan (beda dari star->XP yang setidaknya punya rentang).
    // Lihat docs/PLAN.md.
    const estimatedSec = content.estimatedMinutes * 60;
    const timeBonus = durationSec <= estimatedSec ? 10 : durationSec <= estimatedSec * 1.5 ? 5 : 0;
    const score = Math.min(100, result.accuracyPercent + timeBonus);

    const prismaMode = mode === "TEST" ? "TEST" : "PRACTICE";
    // Hitung SEBELUM insert baris baru -- "pertama kali" harus lihat riwayat
    // SEBELUM attempt ini sendiri ikut terhitung.
    const priorTestAttempts = mode === "TEST" ? await this.prisma.scenarioAttempt.count({ where: { userId, scenarioId, mode: "TEST" } }) : 0;

    await this.prisma.scenarioAttempt.create({ data: { userId, scenarioId, mode: prismaMode, score, durationSec } });

    // XP cuma mode TEST (CONV-04 eksplisit "tercatat ke progres & XP"; CONV-03
    // practice tidak disebut sama sekali), dan cuma percobaan TEST PERTAMA per
    // skenario -- kebijakan anti-farming yang SAMA dengan lesson
    // (lessons.service.ts "justCompletedFirstTime"), belum eksplisit
    // dikonfirmasi PRD, lihat docs/PLAN.md.
    let xpAwarded = 0;
    if (mode === "TEST" && priorTestAttempts === 0) {
      xpAwarded = XpService.scenarioXp;
      await this.gamification.awardXp({ userId, source: "SCENARIO", amount: xpAwarded, refId: scenarioId });
    }

    return { passed, accuracyPercent: result.accuracyPercent, score, mistakeCount: result.mistakeCount, failed: result.failed, xpAwarded };
  }

  private async getPublishedRow(id: string) {
    const row = await this.prisma.scenario.findUnique({ where: { id } });
    if (!row || row.status !== "PUBLISHED") throw new NotFoundException(`Skenario tidak ditemukan: ${id}`);
    return row;
  }

  private parseContent(scenarioId: string, payload: unknown): ScenarioContent {
    const parsed = scenarioContentSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Scenario ${scenarioId} punya payload tidak valid: ${parsed.error.message}`);
    }
    return parsed.data;
  }
}

function collectAudioHashKeys(content: ScenarioContent): string[] {
  const keys: string[] = [];
  for (const line of content.lines) {
    if (line.kind === "narration") keys.push(hashAudioKey(line.jp, "female"));
    else for (const o of line.options) keys.push(hashAudioKey(o.jp, "female"));
  }
  return keys;
}

// Semua audio skenario di-resolve voice 'female' -- konten belum punya
// mapping voice per-speaker/peran (CONV-02 tidak menyebutkannya), beda dari
// TutorModule (Milestone 11) yang MEMANG butuh voice per-karakter. Kalau
// nanti dibutuhkan, `hashAudioKey` sudah menerima parameter voice -- tinggal
// alirkan mapping speaker->voice dari skema konten, bukan redesain.
function enrichWithAudio(content: ScenarioContent, audioUrlByHash: AudioUrlByHash): ScenarioContent {
  return {
    ...content,
    lines: content.lines.map((line) => {
      if (line.kind === "narration") {
        return { ...line, audio: audioUrlByHash.get(hashAudioKey(line.jp, "female")) ?? "" };
      }
      return { ...line, options: line.options.map((o) => ({ ...o, audio: audioUrlByHash.get(hashAudioKey(o.jp, "female")) ?? "" })) };
    }),
  };
}
