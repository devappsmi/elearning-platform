import { Transform } from "class-transformer";
import { normalizeEmail } from "./email.util";

/** Normalkan email (trim + huruf kecil) SEBELUM divalidasi -- `@Transform`
 * jalan sebelum class-validator, jadi `@IsEmail()` menilai bentuk baku yang
 * sama dengan yang nanti disimpan/dicari. Nilai yang bukan string dibiarkan
 * apa adanya supaya `@IsEmail()` yang menolaknya dengan pesan yang benar.
 *
 * Pasang di SETIAP DTO request yang menerima email (login murid/admin, lupa
 * password, undangan). Service tetap menormalkan sendiri (`normalizeEmail`)
 * supaya penulisan ke DB tidak bergantung pada pipe -- pola yang sama dengan
 * `UsersService.update` yang memilih field satu per satu. Lapisan terakhir:
 * CHECK constraint di database (migrasi `emails_lowercase`). */
export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => (typeof value === "string" ? normalizeEmail(value) : value));
}
