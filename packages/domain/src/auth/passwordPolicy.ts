/** Kebijakan password AUTH-02 (PRD §6.1): minimal 8 karakter, mengandung huruf
 * DAN angka.
 *
 * SATU sumber kebenaran untuk dua sisi yang harus selalu sepakat: DTO server
 * (`RegisterDto`/`ResetPasswordDto` di apps/api) dan validasi klien di form
 * murid (registrasi + reset password). Kalau aturan berubah, ubah DI SINI.
 * Server tetap penegak akhir; klien cuma memberi umpan balik cepat sebelum
 * request dikirim. */

export const PASSWORD_MIN_LENGTH = 8;

/** Ada minimal satu huruf (A-Z/a-z, ASCII) dan satu angka. Sama persis dengan
 * yang dipakai `@Matches` di DTO server. */
export const PASSWORD_LETTER_AND_DIGIT = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export type PasswordPolicyViolation = 'TOO_SHORT' | 'MISSING_LETTER_OR_DIGIT';

/** `null` = memenuhi kebijakan. Panjang dihitung per KODE POIN (bukan unit
 * UTF-16), sama dengan `@MinLength` class-validator (validator.js menghitung
 * pasangan surrogate sebagai satu karakter) -- kalau tidak, password berisi
 * emoji bisa lolos klien tapi ditolak server. */
export function passwordPolicyViolation(password: string): PasswordPolicyViolation | null {
  if (Array.from(password).length < PASSWORD_MIN_LENGTH) return 'TOO_SHORT';
  if (!PASSWORD_LETTER_AND_DIGIT.test(password)) return 'MISSING_LETTER_OR_DIGIT';
  return null;
}
