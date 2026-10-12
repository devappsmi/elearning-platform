import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SrsService } from "../srs/srs.service";
import { hashAudioKey } from "../audio/audio-hash.util";
import { loadAudioUrlsByHash } from "../audio/audio-lookup.util";
import type { DueFlashcardDto } from "./dto/due-flashcard.dto";

const DUE_LIMIT = 30;

/** SUP-02: deck otomatis dari ReviewItem yang SrsModule sudah tulis (lihat
 * catatan lengkap SRS di srs.service.ts/LessonsModule) -- modul ini murni
 * KONSUMEN baca+review, tidak ada logic SRS baru di sini. Mode "flip"
 * (lihat kartu, tampilkan jawaban) sepenuhnya di frontend -- endpoint ini
 * cuma menyuplai datanya; mode "tes" (ketik/pilih jawaban) juga sama, cuma
 * `POST /flashcards/review` yang menyimpan hasilnya, terlepas dari UI apa
 * yang dipakai murid untuk memutuskan correct/salah. */
@Injectable()
export class FlashcardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly srs: SrsService,
  ) {}

  async due(userId: string): Promise<DueFlashcardDto[]> {
    const dueItems = await this.prisma.reviewItem.findMany({
      where: { userId, itemType: "WORD", nextReviewAt: { lte: new Date() } },
      orderBy: { nextReviewAt: "asc" },
      take: DUE_LIMIT,
    });
    if (dueItems.length === 0) return [];

    const vocabRows = await this.prisma.vocab.findMany({ where: { id: { in: dueItems.map((i) => i.itemId) } } });
    const vocabById = new Map(vocabRows.map((v) => [v.id, v]));

    const audioUrlByHash = await loadAudioUrlsByHash(
      this.prisma,
      vocabRows.map((v) => hashAudioKey(v.jp, "female")),
    );

    const result: DueFlashcardDto[] = [];
    for (const item of dueItems) {
      const vocab = vocabById.get(item.itemId);
      // Vocab-nya dihapus/berubah setelah jadi ReviewItem (konten diedit) --
      // dilewati diam-diam, bukan crash seluruh deck untuk satu entri basi.
      if (!vocab) continue;
      result.push({
        itemId: item.itemId,
        surface: vocab.jp,
        reading: vocab.reading,
        romaji: vocab.romaji,
        meaning: vocab.meaningId,
        audio: audioUrlByHash.get(hashAudioKey(vocab.jp, "female")) ?? "",
        srsStage: item.srsStage,
        nextReviewAt: item.nextReviewAt,
      });
    }
    return result;
  }

  async review(userId: string, itemId: string, correct: boolean): Promise<void> {
    const vocab = await this.prisma.vocab.findUnique({ where: { id: itemId }, select: { id: true } });
    if (!vocab) throw new NotFoundException(`Kosakata tidak ditemukan: ${itemId}`);
    await this.srs.recordVocabAnswer(userId, itemId, correct);
  }
}
