import { ApiProperty } from "@nestjs/swagger";

/** Bentuk respons AdminInvitationsModule (ADM-10/11/12). `class`, di
 * `dto/*.dto.ts` -- lihat catatan lengkap di
 * learning-path/dto/path-view.dto.ts soal kenapa plugin CLI
 * @nestjs/swagger butuh KEDUANYA. `tokenHash` SENGAJA tidak ada di sini
 * (dan sekarang tidak lagi di-select sama sekali di admin-invitations.service.ts
 * -- sebelumnya balik lewat default-select-semua-field Prisma tanpa
 * `select`/`include` eksplisit, ketahuan pas nulis DTO ini, diperbaiki
 * sekalian; bukan celah eksploitasi praktis (hash dari token acak 256-bit),
 * tapi tidak ada alasan expose hash internal ke frontend sama sekali). */
export class InvitationDto {
  id!: string;
  classId!: string;
  name!: string;
  email!: string;
  @ApiProperty({ enum: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] })
  status!: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expiresAt!: Date;
  acceptedAt!: Date | null;
  revokedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

class InvitationClassSummaryDto {
  id!: string;
  name!: string;
}

// list() -- di atas + nama kelas (join), supaya tabel undangan tidak perlu
// query kelas terpisah per baris.
export class InvitationListItemDto extends InvitationDto {
  class!: InvitationClassSummaryDto;
}
