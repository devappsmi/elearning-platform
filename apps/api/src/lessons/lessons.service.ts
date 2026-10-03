import { BadRequestException, Injectable } from "@nestjs/common";
import { LessonSession, starsForScore, XpService, type AnswerFeedback, type Lesson as DomainLesson, type Unit as DomainUnit } from "@elearning/domain";
import { PrismaService } from "../prisma/prisma.service";
import { ContentService } from "../content/content.service";
import { GamificationService } from "../gamification/gamification.service";
import { SrsService } from "../srs/srs.service";
import type { AnswerEventDto } from "./dto/submit-attempt.dto";
import { AttemptResultView } from "./dto/attempt-result.dto";

const PASS_THRESHOLD = 80;

/** LessonsModule -- Milestone 7, PALING PENTING (lihat docs/PLAN.md).
 *
 * GET /lessons/:id: kirim {unit, lesson} bentuk packages/domain APA ADANYA
 * (termasuk kunci jawaban) supaya client bisa jalankan LessonSession-nya
 * SENDIRI untuk feedback instan per-soal -- "server-authoritative,
 * client-optimistic" (lihat "Keputusan Lintas-Sektor" di plan).
 *
 * POST /lessons/:id/attempts: TIDAK percaya skor/kebenaran dari client sama
 * sekali. Client mengirim LOG event submit (ref + kind + nilai yang dipilih,
 * urut kronologis -- termasuk percobaan ulang atas item yang sempat salah).
 * Server me-replay log itu lewat LessonSession-nya SENDIRI (unit/lesson
 * direkonstruksi ulang dari DB, bukan dipercaya dari request) dan
 * menggunakan `current.refId` di tiap langkah sebagai pengecekan integritas
 * urutan. Grading berdasarkan NILAI (teks opsi/urutan token), bukan index --
 * shuffle opsi client dan server independen/beda, cuma nilai jawaban yang
 * perlu sama, jadi tidak perlu sinkronisasi seed RNG atau state sesi di
 * Redis sama sekali antara GET dan POST. */
@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
    private readonly gamification: GamificationService,
    private readonly srs: SrsService,
  ) {}

  async getLessonContent(lessonId: string): Promise<{ unit: DomainUnit; lesson: DomainLesson }> {
    return this.content.loadLessonWithUnit(lessonId);
  }

  async submitAttempt(userId: string, lessonId: string, answers: AnswerEventDto[]): Promise<AttemptResultView> {
    const { unit, lesson } = await this.content.loadLessonWithUnit(lessonId);
    await this.content.assertLessonUnlocked(userId, unit.id, lesson.id);
    const lessonRow = await this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { isCheckpoint: true } });

    const session = new LessonSession({ unit, lesson });
    const wrongRefs = new Set<string>();
    // refId Vocab -> pernah salah sepanjang attempt ini? (cuma exercise choose
    // ATAS vocab yang dilacak ke SRS -- LP-04 eksplisit bilang "kata/kanji",
    // bukan kalimat; exercise assemble & choose-kalimat TIDAK masuk ReviewItem,
    // tapi tetap masuk `wrongRefs` untuk "review jawaban salah" di S6.)
    const vocabEverWrong = new Map<string, boolean>();

    for (const answer of answers) {
      if (session.isFinished) throw new BadRequestException("Jumlah jawaban melebihi jumlah soal di lesson ini");
      const current = session.current;
      if (current.refId !== answer.ref) {
        throw new BadRequestException(
          `Urutan jawaban tidak valid untuk lesson ini (diharapkan ref '${current.refId}', dapat '${answer.ref}')`,
        );
      }

      let feedback: AnswerFeedback;
      if (current.kind === "choose") {
        if (answer.kind !== "choose" || typeof answer.choiceText !== "string") {
          throw new BadRequestException(`Exercise '${answer.ref}' butuh choiceText (tipe choose)`);
        }
        // -1 kalau choiceText tidak cocok opsi mana pun (tampering) -- aman,
        // correctIndex domain selalu >= 0 jadi otomatis dinilai salah, bukan
        // exception/array-index invalid (lihat LessonSession.submitChoice).
        const chosenIndex = current.options.findIndex((o) => o.text === answer.choiceText);
        feedback = session.submitChoice(chosenIndex);
        if (current.isVocab) {
          vocabEverWrong.set(current.refId, (vocabEverWrong.get(current.refId) ?? false) || !feedback.correct);
        }
      } else {
        if (answer.kind !== "assemble" || !Array.isArray(answer.tokens)) {
          throw new BadRequestException(`Exercise '${answer.ref}' butuh tokens (tipe assemble)`);
        }
        feedback = session.submitAssemble(answer.tokens);
      }

      if (!feedback.correct) wrongRefs.add(current.refId);
      session.next();
    }

    if (!session.isFinished) throw new BadRequestException("Belum semua soal di lesson ini dijawab");

    const result = session.result;
    const passed = result.accuracyPercent >= PASS_THRESHOLD;
    const stars = passed ? starsForScore(result.accuracyPercent) : 0;

    const progress = await this.upsertProgress(userId, lessonId, result.accuracyPercent, stars);

    // XP cuma diberikan saat lesson PERTAMA KALI tuntas -- keputusan desain
    // (PRD tidak eksplisit membahas ulangi lesson yang sudah lulus): tanpa
    // batas ini, mengulang lesson mudah yang sama berkali-kali jadi XP
    // farming tanpa batas. Mengulang tetap diizinkan (skor terbaik dicatat),
    // cuma tidak menghasilkan XP baru lagi. Lihat docs/PLAN.md.
    let xpAwarded = 0;
    if (passed && progress.justCompletedFirstTime) {
      // Panggil ulang starsForScore (bukan pakai `stars` di atas) supaya
      // tipenya tetap LessonStars (1|2|3) sempit, bukan `0 | LessonStars` --
      // aman karena precondition-nya (passed) sudah dicek dua-duanya di sini.
      xpAwarded = lessonRow.isCheckpoint ? XpService.checkpointXp : XpService.lessonXp(starsForScore(result.accuracyPercent));
      await this.gamification.awardXp({
        userId,
        source: lessonRow.isCheckpoint ? "CHECKPOINT" : "LESSON",
        amount: xpAwarded,
        refId: lessonId,
      });
    }

    for (const [vocabId, everWrong] of vocabEverWrong) {
      await this.srs.recordVocabAnswer(userId, vocabId, !everWrong);
    }

    return {
      passed,
      accuracyPercent: result.accuracyPercent,
      stars,
      xpAwarded,
      bestScore: progress.bestScore,
      bestStars: progress.bestStars,
      attempts: progress.attempts,
      wrongRefs: [...wrongRefs],
    };
  }

  /** Upsert UserLessonProgress: skor TERBAIK lintas percobaan menang (lihat
   * komentar schema.prisma), `attempts` selalu bertambah (lulus atau gagal),
   * `completedAt` cuma di-set sekali (percobaan pertama yang lulus) dan
   * tidak pernah di-reset walau percobaan berikutnya skornya lebih rendah. */
  private async upsertProgress(
    userId: string,
    lessonId: string,
    newScore: number,
    newStars: number,
  ): Promise<{ bestScore: number; bestStars: number; attempts: number; justCompletedFirstTime: boolean }> {
    const passed = newScore >= PASS_THRESHOLD;
    const existing = await this.prisma.userLessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });

    if (!existing) {
      const created = await this.prisma.userLessonProgress.create({
        data: { userId, lessonId, score: newScore, stars: newStars, attempts: 1, completedAt: passed ? new Date() : null },
      });
      return { bestScore: created.score, bestStars: created.stars, attempts: created.attempts, justCompletedFirstTime: passed };
    }

    const improved = newScore > existing.score;
    const justCompletedFirstTime = passed && existing.completedAt === null;
    const updated = await this.prisma.userLessonProgress.update({
      where: { id: existing.id },
      data: {
        attempts: { increment: 1 },
        score: improved ? newScore : undefined,
        stars: improved ? newStars : undefined,
        completedAt: existing.completedAt ?? (passed ? new Date() : null),
      },
    });
    return { bestScore: updated.score, bestStars: updated.stars, attempts: updated.attempts, justCompletedFirstTime };
  }
}
