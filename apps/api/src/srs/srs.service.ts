import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { addDuration } from "../common/duration.util";

/** LP-04: interval SRS 1 -> 3 -> 7 -> 14 -> 30 hari, index = ReviewItem.srsStage. */
const SRS_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

/** Sisi tulis SRS (internal, belum ada controller -- konsumen baca
 * (FlashcardsModule "GET /flashcards/due", kuis harian SUP-03) adalah
 * Milestone 9, belum dikerjakan). Dipanggil LessonsService per kata (Vocab)
 * yang dijawab dalam satu lesson attempt, SETELAH UserLessonProgress
 * ter-upsert -- sengaja panggilan terpisah (bukan satu $transaction lintas
 * modul dengan Gamification/UserLessonProgress): kegagalan di sini paling
 * buruk cuma bikin satu ReviewItem telat ter-update, bukan kehilangan skor
 * lesson: menimbang itu terhadap kerumitan thread Prisma.TransactionClient
 * lintas 3 service, dipilih yang sederhana. Lihat catatan sama di
 * GamificationService. */
@Injectable()
export class SrsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordVocabAnswer(userId: string, vocabId: string, correct: boolean): Promise<void> {
    const now = new Date();
    const where = { userId_itemType_itemId: { userId, itemType: "WORD" as const, itemId: vocabId } };

    if (!correct) {
      // Salah (kapan pun selama attempt) -> mulai ulang dari stage 0, muncul
      // lagi besok. Ini juga jalur "item baru masuk antrian SRS" -- item yang
      // TIDAK PERNAH salah tidak pernah dapat baris ReviewItem sama sekali.
      await this.prisma.reviewItem.upsert({
        where,
        update: { srsStage: 0, nextReviewAt: addDuration(now, "1d"), lastResult: false },
        create: { userId, itemType: "WORD", itemId: vocabId, srsStage: 0, nextReviewAt: addDuration(now, "1d"), lastResult: false },
      });
      return;
    }

    const existing = await this.prisma.reviewItem.findUnique({ where });
    if (!existing) return; // tidak pernah salah -> bukan bagian antrian review, tidak ada yang perlu dimajukan

    const nextStage = existing.srsStage + 1;
    if (nextStage >= SRS_INTERVAL_DAYS.length) {
      // Lulus di interval terpanjang (30 hari) -- keputusan desain: dianggap
      // "dikuasai" dan keluar dari antrian review aktif. PRD tidak
      // menspesifikasi perilaku sesudah stage terakhir; lihat docs/PLAN.md.
      await this.prisma.reviewItem.delete({ where: { id: existing.id } });
      return;
    }

    await this.prisma.reviewItem.update({
      where: { id: existing.id },
      data: { srsStage: nextStage, nextReviewAt: addDuration(now, `${SRS_INTERVAL_DAYS[nextStage]}d`), lastResult: true },
    });
  }
}
