/** Target XP harian (GAM-01: murid bisa memilih 10/30/50, bawaan 30). Dipakai
 * halaman Profil dan onboarding /welcome -- satu daftar, satu type guard. */
export const XP_GOAL_OPTIONS = [10, 30, 50] as const;
export type XpGoal = (typeof XP_GOAL_OPTIONS)[number];

export function isXpGoal(value: number): value is XpGoal {
  return (XP_GOAL_OPTIONS as readonly number[]).includes(value);
}
