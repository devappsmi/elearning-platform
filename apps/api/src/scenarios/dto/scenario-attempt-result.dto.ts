// Bentuk respons POST /scenarios/:id/attempts (CONV-03/04). `class`, di
// `dto/*.dto.ts` -- lihat catatan lengkap di
// learning-path/dto/path-view.dto.ts. Dulu `ScenarioAttemptResult`
// interface di scenarios.service.ts -- registrasi skema OpenAPI KOSONG
// walau dipakai sebagai tipe balik.
export class ScenarioAttemptResultDto {
  passed!: boolean;
  accuracyPercent!: number;
  score!: number;
  mistakeCount!: number;
  failed!: boolean;
  xpAwarded!: number;
}
