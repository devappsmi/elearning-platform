/** Bentuk data progres murni (tanpa Dexie), port dari lib/data/models/progress_models.dart. */

export interface LessonProgress {
  unitId: string;
  lessonId: string;
  completed: boolean;
  bestSpeakingScore?: number;
  firstCompletedAt?: Date;
}

export function lessonProgressKey(unitId: string, lessonId: string): string {
  return `${unitId}/${lessonId}`;
}

export interface DailyActivity {
  date: string;
  xp: number;
  minutes: number;
  lessonsCompleted: number;
}

export function emptyDailyActivity(date: string): DailyActivity {
  return { date, xp: 0, minutes: 0, lessonsCompleted: 0 };
}

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate?: Date;
}

export const defaultStreakState: StreakState = { current: 0, longest: 0 };

export interface SpeakingAttempt {
  refId: string;
  score: number;
  date: Date;
}

export interface UserStats {
  totalXp: number;
  learnedWordIds: Set<string>;
}

export const defaultUserStats: UserStats = { totalXp: 0, learnedWordIds: new Set() };
