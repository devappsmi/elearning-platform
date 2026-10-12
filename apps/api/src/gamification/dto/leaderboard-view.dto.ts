// Bentuk respons GET /leaderboard (GAM-03). `class`, di `dto/*.dto.ts` --
// lihat catatan lengkap di learning-path/dto/path-view.dto.ts. Dulu
// `LeaderboardEntry` interface di gamification.service.ts -- registrasi
// skema OpenAPI KOSONG walau dipakai sebagai tipe balik.
export class LeaderboardEntryDto {
  userId!: string;
  name!: string;
  xp!: number;
  rank!: number;
}

export class LeaderboardResponseDto {
  weekOf!: string;
  entries!: LeaderboardEntryDto[];
}
