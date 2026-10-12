import { ApiProperty } from "@nestjs/swagger";
import { UserStatus, XpSource } from "@prisma/client";

class StudentClassSummaryDto {
  id!: string;
  name!: string;
}

export class StudentListItemDto {
  id!: string;
  name!: string;
  email!: string;
  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;
  lastActiveAt!: Date | null;
  createdAt!: Date;
  class!: StudentClassSummaryDto;
  totalXp!: number;
  streak!: number;
}

// update() balikin bentuk yang sama persis (lihat admin-students.service.ts).
export class StudentDetailDto {
  id!: string;
  name!: string;
  email!: string;
  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;
  avatarUrl!: string | null;
  dailyXpGoal!: number;
  lastActiveAt!: Date | null;
  createdAt!: Date;
  class!: StudentClassSummaryDto;
}

// Bentuk kecil+stabil dari packages/domain (XpService.levelForXp) -- beda
// dari Unit/Lesson (dibiarkan tanpa anotasi di lessons.controller.ts,
// lihat catatan di learning-path/dto/path-view.dto.ts): tiga field angka
// datar, aman didefinisikan ulang sebagai DTO tanpa membocorkan concern
// Swagger ke paket domain murni.
export class LevelInfoDto {
  level!: number;
  xpIntoLevel!: number;
  xpForNextLevel!: number;
}

class StreakInfoDto {
  current!: number;
  longest!: number;
}

class UnitProgressDto {
  unitId!: string;
  unitTitle!: string;
  completedLessons!: number;
  totalStars!: number;
  averageStars!: number;
}

class ScenarioProgressDto {
  scenarioId!: string;
  titleJp!: string;
  titleId!: string;
  attempts!: number;
  bestScore!: number;
  lastAttemptAt!: Date;
}

class RecentActivityDto {
  @ApiProperty({ enum: XpSource })
  source!: XpSource;
  amount!: number;
  refId!: string | null;
  at!: Date;
}

class ActivityHeatmapPointDto {
  date!: string;
  xp!: number;
}

export class StudentProgressDto {
  xpTotal!: number;
  level!: LevelInfoDto;
  streak!: StreakInfoDto;
  unitProgress!: UnitProgressDto[];
  // GAP tertutup sesi ini (dulu dicatat di docs/PLAN.md bagian 6c): ADM-31 AC
  // minta "skor percakapan" -- ScenarioAttempt sekarang ada datanya
  // (Milestone 9 lanjutan), sebelumnya field ini belum ditambahkan ke sini.
  scenarioProgress!: ScenarioProgressDto[];
  recentActivity!: RecentActivityDto[];
  activityHeatmap!: ActivityHeatmapPointDto[];
}

export class ResetPasswordResponseDto {
  message!: string;
}
