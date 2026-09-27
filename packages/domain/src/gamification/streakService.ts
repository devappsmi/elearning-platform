import { daysBetween, dateOnly } from '../shared/dates';
import type { StreakState } from './types';

/** Port dari lib/features/progress/streak_service.dart. */
export const StreakService = {
  /** Dipanggil saat app dibuka: streak putus jika ada satu hari penuh tanpa aktivitas. */
  evaluate(s: StreakState, today: Date): StreakState {
    const last = s.lastActiveDate;
    if (!last) return s;
    if (daysBetween(last, today) >= 2) return { ...s, current: 0 };
    return s;
  },

  /** Dipanggil saat pelajaran selesai. */
  onLessonCompleted(s: StreakState, today: Date): StreakState {
    const last = s.lastActiveDate;
    let current: number;
    if (!last) {
      current = 1;
    } else {
      const gap = daysBetween(last, today);
      if (gap === 0) return s;
      current = gap === 1 ? s.current + 1 : 1;
    }
    const longest = Math.max(current, s.longest);
    return { current, longest, lastActiveDate: dateOnly(today) };
  },
};
