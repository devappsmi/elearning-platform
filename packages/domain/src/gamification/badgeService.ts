export interface BadgeContext {
  lessonsCompleted: number;
  streakCurrent: number;
  wordsLearned: number;
  speakingHighCount: number;
  completedUnitIds: Set<string>;
  awarded: Set<string>;
}

/** Port dari lib/features/progress/badge_service.dart. */
export const BadgeService = {
  firstLesson: 'first_lesson',
  streak7: 'streak_7',
  streak30: 'streak_30',
  hiraganaMaster: 'hiragana_master',
  katakanaMaster: 'katakana_master',
  words100: 'words_100',
  speaker50: 'speaker_50',

  /** Skor minimal agar satu latihan speak dihitung untuk lencana speaker_50. */
  speakerScoreThreshold: 80,

  hiraganaUnitId: 'unit_hiragana',
  katakanaUnitId: 'unit_katakana',

  unitBadge(unitId: string): string {
    return `${unitId}_complete`;
  },

  /** Mengembalikan lencana baru yang belum ada di BadgeContext.awarded. */
  evaluate(c: BadgeContext): string[] {
    const candidates: string[] = [];
    if (c.lessonsCompleted >= 1) candidates.push(BadgeService.firstLesson);
    if (c.streakCurrent >= 7) candidates.push(BadgeService.streak7);
    if (c.streakCurrent >= 30) candidates.push(BadgeService.streak30);
    if (c.wordsLearned >= 100) candidates.push(BadgeService.words100);
    if (c.speakingHighCount >= 50) candidates.push(BadgeService.speaker50);
    for (const unitId of c.completedUnitIds) {
      if (unitId === BadgeService.hiraganaUnitId) candidates.push(BadgeService.hiraganaMaster);
      else if (unitId === BadgeService.katakanaUnitId) candidates.push(BadgeService.katakanaMaster);
      else candidates.push(BadgeService.unitBadge(unitId));
    }
    return candidates.filter((id) => !c.awarded.has(id));
  },
};
