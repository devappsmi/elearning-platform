// Bentuk respons GET /scenarios (CONV-01, katalog). `class`, di
// `dto/*.dto.ts` -- lihat catatan lengkap di
// learning-path/dto/path-view.dto.ts. Dulu `ScenarioSummary` interface di
// scenarios.service.ts -- registrasi skema OpenAPI KOSONG walau dipakai
// sebagai tipe balik.
export class ScenarioSummaryDto {
  id!: string;
  titleJp!: string;
  titleId!: string;
  level!: string;
  roles!: string[];
  estimatedMinutes!: number;
}
