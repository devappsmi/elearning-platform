import { ApiProperty } from "@nestjs/swagger";

/** Bentuk respons GET /admin/dashboard (ADM-30). `class`, di `dto/*.dto.ts`
 * -- lihat catatan lengkap di learning-path/dto/path-view.dto.ts soal kenapa
 * plugin CLI @nestjs/swagger butuh KEDUANYA (class, dan lokasi file). */
export class ClassCompletionRateDto {
  classId!: string;
  className!: string;
  studentCount!: number;
  completionRate!: number;
}

export class DashboardSummaryDto {
  activeStudentsThisWeek!: number;
  totalActiveStudents!: number;
  averageXp!: number;
  // Peta bucket->jumlah murid ("0"/"1-3"/"4-7"/"8-14"/"15-30"/"30+", lihat
  // bucketStreak() di admin-dashboard.service.ts) -- dictionary, BUKAN
  // sekumpulan field bernama tetap, jadi dimodelkan lewat
  // additionalProperties (map key sembarang -> number), bukan class
  // bersarang dengan properti berkunci string literal aneh (`"1-3"`).
  @ApiProperty({ type: "object", additionalProperties: { type: "number" } })
  streakDistribution!: Record<string, number>;
  lessonCompletionRateByClass!: ClassCompletionRateDto[];
}
