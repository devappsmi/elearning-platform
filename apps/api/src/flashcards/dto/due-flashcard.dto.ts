// Bentuk respons FlashcardsModule (SUP-02). `class`, di `dto/*.dto.ts` --
// lihat catatan lengkap di learning-path/dto/path-view.dto.ts. Dulu
// `DueFlashcard` interface di flashcards.service.ts -- registrasi skema
// OpenAPI KOSONG walau dipakai sebagai tipe balik.
export class DueFlashcardDto {
  itemId!: string;
  surface!: string;
  reading!: string;
  romaji!: string;
  meaning!: string | null;
  audio!: string;
  srsStage!: number;
  nextReviewAt!: Date;
}

export class FlashcardReviewResponseDto {
  message!: string;
}
