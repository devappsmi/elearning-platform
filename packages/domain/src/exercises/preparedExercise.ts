/** Port dari lib/features/lesson/prepared_exercise.dart. Discriminated union
 * lewat `kind` -- padanan `sealed class` Dart, memberi exhaustive-check yang
 * sama lewat `switch` TypeScript.
 *
 * Varian `speak` (dan tipe `SpeakTarget`-nya) SENGAJA TIDAK diporting: skema
 * 5-tipe exercise baru (CHOOSE/MATCHING/ASSEMBLE/LISTENING/FILL_IN) tidak
 * punya tipe "speak" -- pronunciation scoring sedang didesain ulang terpisah
 * (lihat plan Fase 2), dan modul sumbernya
 * (webapp/src/domain/speaking/pronunciationScorer.ts) memang di luar cakupan
 * port ini. MATCHING/LISTENING/FILL_IN belum ditambahkan di sini karena tidak
 * ada preseden untuk diporting -- akan dibangun baru saat fiturnya digarap. */

export interface ChoiceOption {
  text: string;
  sub?: string;
}

export interface PreparedChoose {
  kind: 'choose';
  refId: string;
  isVocab: boolean;
  prompt: string;
  promptSub?: string;
  options: ChoiceOption[];
  correctIndex: number;
}

export interface PreparedAssemble {
  kind: 'assemble';
  refId: string;
  prompt: string;
  promptSub?: string;
  bank: string[];
  correct: string[];
}

export type PreparedExercise = PreparedChoose | PreparedAssemble;
