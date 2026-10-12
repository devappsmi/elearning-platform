import { ApiProperty } from "@nestjs/swagger";
import { AdminRole } from "@prisma/client";

/** Cocok PERSIS dengan `select` di AdminAuthService.me -- lihat catatan
 * padanannya di users/dto/me.dto.ts soal kenapa anotasi tipe balik
 * eksplisit ini dibutuhkan plugin CLI @nestjs/swagger. passwordHash
 * SENGAJA tidak ada di sini (dan tidak ada di select service-nya).
 *
 * `role` butuh `@ApiProperty({ enum })` MANUAL (beda dari field lain di
 * sini) -- plugin CLI tidak bisa menyimpulkan union string dari tipe enum
 * hasil generate Prisma, jatuh ke `type: "object"` kosong tanpa ini
 * (ketahuan lewat inspeksi langsung openapi.json, bukan diasumsikan). */
export class MeAdminDto {
  id!: string;
  name!: string;
  email!: string;
  @ApiProperty({ enum: AdminRole })
  role!: AdminRole;
  isActive!: boolean;
  createdAt!: Date;
  lastLoginAt!: Date | null;
}
