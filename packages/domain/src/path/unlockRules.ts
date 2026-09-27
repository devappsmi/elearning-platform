import type { Lesson, Unit } from '../content/types';

/** Aturan buka kunci unit dan pelajaran secara berurutan (unit/pelajaran ke-N
 * terbuka begitu unit/pelajaran ke-(N-1) tuntas). Kunci pelajaran:
 * `<unitId>/<lessonId>`. Port dari lib/features/home/unlock_rules.dart.
 *
 * Catatan: ini aturan umum, bukan aturan khusus "unit percakapan butuh
 * Hiragana DAN Katakana" -- tapi dengan urutan konten Hiragana=1,
 * Katakana=2, unit percakapan=3+, aturan berurutan ini SUDAH otomatis
 * menghasilkan efek itu (unit percakapan baru terbuka setelah Katakana
 * tuntas, yang mensyaratkan Hiragana tuntas duluan secara transitif). */
export const UnlockRules = {
  lessonKey(u: Unit, l: Lesson): string {
    return `${u.id}/${l.id}`;
  },

  isUnitComplete(u: Unit, completedLessonKeys: Set<string>): boolean {
    return u.lessons.length > 0 && u.lessons.every((l) => completedLessonKeys.has(UnlockRules.lessonKey(u, l)));
  },

  isUnitUnlocked(units: Unit[], index: number, completedLessonKeys: Set<string>): boolean {
    return index === 0 || UnlockRules.isUnitComplete(units[index - 1]!, completedLessonKeys);
  },

  isLessonUnlocked(u: Unit, index: number, completedLessonKeys: Set<string>): boolean {
    return index === 0 || completedLessonKeys.has(UnlockRules.lessonKey(u, u.lessons[index - 1]!));
  },
};
