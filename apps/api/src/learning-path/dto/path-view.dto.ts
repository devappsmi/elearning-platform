import { ApiProperty } from "@nestjs/swagger";

/** Bentuk respons GET /path (LP-01/02). `class`, BUKAN `interface` -- lihat
 * catatan di common/dto/token-pair.dto.ts soal kenapa plugin CLI
 * @nestjs/swagger butuh ini untuk skema respons. LEBIH SPESIFIK: kelas ini
 * SEBELUMNYA ada di learning-path.service.ts, dan tetap KOSONG di
 * openapi.json walau sudah class -- plugin CLI cuma menganalisis file yang
 * namanya cocok `dtoFileNameSuffix` (default `.dto.ts`/`.entity.ts`), file
 * `.service.ts` dilewati begitu saja walau dipakai sebagai anotasi tipe
 * balik controller. Dipindah ke sini (bukan ubah config plugin) supaya
 * konsisten dengan pola dto/ yang sudah dipakai di seluruh modul lain.
 *
 * `state`/`type` di bawah butuh `@ApiProperty({enum})` MANUAL -- union
 * string literal (bukan enum TS/Prisma sungguhan) tidak bisa disimpulkan
 * plugin CLI sama sekali, persis catatan `MeAdminDto.role` di
 * admin-auth/dto/me-admin.dto.ts, cuma sumbernya di sini union literal,
 * bukan enum Prisma. */

export class PathLessonView {
  id!: string;
  title!: string;
  order!: number;
  isCheckpoint!: boolean;
  @ApiProperty({ enum: ["done", "available", "locked"] })
  state!: "done" | "available" | "locked";
  stars!: number | null;
}

export class PathUnitView {
  id!: string;
  title!: string;
  order!: number;
  @ApiProperty({ enum: ["kana", "conversation"] })
  type!: "kana" | "conversation";
  unlocked!: boolean;
  completedLessons!: number;
  totalLessons!: number;
  lessons!: PathLessonView[];
}

export class PathLevelView {
  id!: string;
  code!: string;
  name!: string;
  order!: number;
  units!: PathUnitView[];
}

export class StreakView {
  current!: number;
  longest!: number;
}

export class PathView {
  levels!: PathLevelView[];
  continueLessonId!: string | null;
  streak!: StreakView;
}
