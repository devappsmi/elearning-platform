import { ValidationPipe, type ValidationPipeOptions } from "@nestjs/common";

/** Opsi validasi request untuk SELURUH API -- didaftarkan sebagai `APP_PIPE`
 * di AppModule (bukan di main.ts, supaya ikut berlaku di modul uji apa pun
 * yang mengimpor AppModule) dan diekspor supaya tes memakai konfigurasi yang
 * SAMA persis dengan yang berjalan.
 *
 * - `whitelist` + `forbidNonWhitelisted`: field yang tidak dideklarasikan di
 *   DTO DITOLAK (400), bukan diteruskan diam-diam. Ini pertahanan utama
 *   terhadap mass assignment (mis. `PATCH /me {"classId":...}`) -- lihat
 *   docs/PLAN.md bagian 6e. Konsekuensi yang disengaja: SETIAP properti DTO
 *   HARUS punya minimal satu dekorator class-validator (kalau tidak, client
 *   yang mengirimnya kena 400); tes penjaga di
 *   controller-input-guard.test.ts memeriksanya secara statis.
 * - `transform`: handler menerima instance DTO (termasuk hasil `@Transform`
 *   seperti `@Trim()`), bukan objek mentah dari body.
 *
 * Kalau nanti ada klien lama yang perlu dilonggarkan, ubah
 * `forbidNonWhitelisted` jadi false: field tak dikenal tetap DIBUANG
 * (whitelist), hanya tidak lagi menghasilkan 400. */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
};

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe(VALIDATION_PIPE_OPTIONS);
}
