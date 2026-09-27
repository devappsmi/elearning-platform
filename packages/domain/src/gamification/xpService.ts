/** Port dari lib/features/progress/xp_service.dart, DIRETUNE mengikuti PRD
 * v4.0 (§GAM-01/GAM-03) -- bentuk (shape) fungsinya dipertahankan, tapi
 * angka dan input formulanya beda total dari versi lama.
 *
 * Formula lama: `10 + 1×correctFirstTry + 5×speakHighCount`, level curve
 * `100×n` XP kumulatif.
 *
 * PRD v4.0: penyelesaian lesson +10/20/30 XP menurut rating bintang (1/2/3),
 * checkpoint +50, skenario/percakapan +20, kuis harian +10, level curve
 * `1000×n` XP kumulatif (BUKAN 100×n).
 *
 * `speakHighCount` DIHAPUS TOTAL (bukan dihardcode ke 0): skema exercise baru
 * cuma py 5 tipe -- CHOOSE/MATCHING/ASSEMBLE/LISTENING/FILL_IN -- tidak ada
 * lagi tipe `speak`, jadi parameter itu tidak punya padanan input sama sekali
 * lagi di sistem baru. */

export type LessonStars = 1 | 2 | 3;

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/** Mapping rating bintang -> XP lesson (1★=10, 2★=20, 3★=30).
 *
 * PENTING: ini PROPOSAL milik porting ini, BUKAN angka yang eksplisit
 * tertulis di PRD. PRD §GAM-01/GAM-03 cuma menyebutkan rentang XP lesson
 * "10-30" dan rating "1-3 bintang" secara terpisah -- tidak pernah memetakan
 * keduanya secara eksplisit satu-ke-satu. Mapping linear (bintang x 10) di
 * bawah ini dipilih sebagai asumsi paling sederhana yang konsisten dengan
 * rentang tsb, dan sudah ditandai di plan sebagai "perlu dikonfirmasi ke
 * product owner, bukan blocker development". JANGAN dianggap final. */
export const XP_PER_STAR: Record<LessonStars, number> = {
  1: 10,
  2: 20,
  3: 30,
};

/** LP-03: lulus >= 80%; bintang 80-89%=1, 90-99%=2, 100%=3. Precondition:
 * cuma dipanggil untuk lesson yang LULUS -- caller (mis. LessonsModule di
 * apps/api) yang menentukan lulus/gagal dari `LessonResult.accuracyPercent`
 * lebih dulu; fungsi ini cuma memetakan skor lulus ke rating bintang, bukan
 * memutuskan lulus/gagal itu sendiri. */
export function starsForScore(accuracyPercent: number): LessonStars {
  if (accuracyPercent >= 100) return 3;
  if (accuracyPercent >= 90) return 2;
  if (accuracyPercent >= 80) return 1;
  throw new Error(
    `starsForScore: skor ${accuracyPercent} di bawah ambang lulus (80) -- pastikan caller cek lulus/gagal dulu`,
  );
}

export const XpService = {
  /** GAM-01/03: XP tetap untuk checkpoint, skenario/percakapan, dan kuis harian. */
  checkpointXp: 50,
  scenarioXp: 20,
  dailyQuizXp: 10,

  /** XP dari menyelesaikan satu lesson, menurut rating bintangnya (lihat XP_PER_STAR). */
  lessonXp(stars: LessonStars): number {
    return XP_PER_STAR[stars];
  },

  /** Level n ke n+1 butuh 1000 x n XP (PRD v4.0 §GAM-03; versi lama 100 x n). */
  levelForXp(totalXp: number): LevelInfo {
    let level = 1;
    let remaining = totalXp;
    let need = 1000;
    while (remaining >= need) {
      remaining -= need;
      level++;
      need = 1000 * level;
    }
    return { level, xpIntoLevel: remaining, xpForNextLevel: need };
  },
};
