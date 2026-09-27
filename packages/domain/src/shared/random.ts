/** RNG seam supaya kode yang butuh keacakan (mis. ExerciseFactory) bisa
 * disuntik generator lain saat dites -- padanan parameter `Random? random`
 * di constructor Dart-nya. `rng()` mengembalikan angka [0, 1), sama seperti
 * `Math.random`. */
export type Rng = () => number;

export function nextInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

/** Fisher-Yates, tidak mengubah array asli. */
export function shuffled<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    // `i`/`j` selalu index valid (0 <= j <= i < result.length) di sini --
    // noUncheckedIndexedAccess tidak bisa membuktikan itu sendiri.
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
