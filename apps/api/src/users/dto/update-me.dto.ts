import { IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  // GAM-01: murid bisa ubah target harian 10/30/50
  @IsOptional()
  @IsIn([10, 30, 50])
  dailyXpGoal?: number;
}
