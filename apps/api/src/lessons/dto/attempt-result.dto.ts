/** Bentuk respons POST /lessons/:id/attempts. `class`, BUKAN `interface` --
 * dan SENGAJA di dto/ (bukan di lessons.service.ts, sekalipun sebelumnya di
 * sana) -- lihat catatan lengkap di learning-path/dto/path-view.dto.ts soal
 * kenapa plugin CLI @nestjs/swagger butuh KEDUANYA (class, dan file
 * `.dto.ts`) untuk menghasilkan skema respons yang benar. */
export class AttemptResultView {
  passed!: boolean;
  accuracyPercent!: number;
  stars!: number;
  xpAwarded!: number;
  bestScore!: number;
  bestStars!: number;
  attempts!: number;
  wrongRefs!: string[];
}
