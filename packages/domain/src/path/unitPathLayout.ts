import type { Unit } from '../content/types';
import { clamp } from '../shared/math';
import { type NodePoint, PathLayout } from './pathLayout';
import { UnlockRules } from './unlockRules';

/** Logika yang sebelumnya inline di widget `UnitPathCard`
 * (lib/features/home/unit_path_card.dart: `_stateOf`, `_completedCount`,
 * amplitude clamp, posisi milestone) ditarik keluar jadi fungsi murni
 * tersendiri di sini supaya bisa dites tanpa merender komponen -- perbaikan
 * kecil dibanding versi asli, bukan cuma port. */

export type NodeState = 'done' | 'available' | 'locked';

export const MILESTONE_EVERY = 4;

/** Status tiap node pelajaran dalam satu unit, index sejajar dengan `unit.lessons`. */
export function deriveNodeStates(
  unit: Unit,
  unitUnlocked: boolean,
  completedLessonKeys: Set<string>,
): NodeState[] {
  return unit.lessons.map((_, index) => {
    if (!unitUnlocked) return 'locked';
    if (completedLessonKeys.has(UnlockRules.lessonKey(unit, unit.lessons[index]!))) return 'done';
    return UnlockRules.isLessonUnlocked(unit, index, completedLessonKeys) ? 'available' : 'locked';
  });
}

export function completedLessonCount(unit: Unit, completedLessonKeys: Set<string>): number {
  return unit.lessons.filter((l) => completedLessonKeys.has(UnlockRules.lessonKey(unit, l))).length;
}

/** `(width / 2 - 70).clamp(20, 80)` -- seberapa jauh node bergeser dari
 * garis tengah, supaya jalur tetap masuk kartu di layar sempit maupun lebar. */
export function computeAmplitude(width: number): number {
  return clamp(width / 2 - 70, 20, 80);
}

/** Posisi penanda milestone dekoratif: titik tengah tiap pasangan node ke-4
 * dan ke-5, ke-8 dan ke-9, dst. */
export function milestonePositions(points: NodePoint[], every: number = MILESTONE_EVERY): NodePoint[] {
  const result: NodePoint[] = [];
  for (let i = every - 1; i + 1 < points.length; i += every) {
    // Loop-guard `i + 1 < points.length` sudah menjamin kedua index valid.
    result.push(PathLayout.midpoint(points[i]!, points[i + 1]!));
  }
  return result;
}
