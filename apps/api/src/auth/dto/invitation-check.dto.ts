import { ApiProperty } from "@nestjs/swagger";

export const INVITATION_VALIDATION_REASONS = ["VALID", "NOT_FOUND", "EXPIRED", "REVOKED", "ALREADY_ACCEPTED"] as const;
export type InvitationValidationReason = (typeof INVITATION_VALIDATION_REASONS)[number];

/** Bentuk respons `POST /auth/invitations/validate` (halaman /invite/:token,
 * PRD S1 "Sambutan lembaga, form registrasi"). `class` di `dto/*.dto.ts`, lihat
 * catatan di common/dto/token-pair.dto.ts soal kenapa plugin CLI Swagger
 * butuh itu; `reason` butuh `@ApiProperty({ enum })` manual karena union
 * string literal tidak bisa disimpulkan plugin.
 *
 * Detail (`name`/`email`/`className`/`institutionName`) HANYA terisi saat
 * `reason === "VALID"` -- pemegang token yang valid memang penerima undangan
 * itu, sedangkan token tak valid/kedaluwarsa tidak boleh membocorkan apa pun
 * soal siapa/kelas mana. `invitationId` dipertahankan (sudah ada sebelumnya). */
export class InvitationCheckDto {
  @ApiProperty({ enum: INVITATION_VALIDATION_REASONS })
  reason!: InvitationValidationReason;

  invitationId?: string;

  /** Nama yang diisi admin -- jadi isian awal form (boleh diubah murid). */
  name?: string;

  /** Email undangan -- terkunci di form (AUTH-02: "terisi otomatis & terkunci"). */
  email?: string;

  className?: string;

  /** null = baris Institution belum ada (belum ada halaman/seed yang mengisinya). */
  institutionName?: string | null;
}
