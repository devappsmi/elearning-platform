import { PASSWORD_MIN_LENGTH, passwordPolicyViolation } from "@elearning/domain";

export const PASSWORD_HINT = `Minimal ${PASSWORD_MIN_LENGTH} karakter, mengandung huruf dan angka.`;

/** Validasi klien untuk form password baru (registrasi + reset). Aturannya
 * dari @elearning/domain -- SAMA dengan yang ditegakkan server (AUTH-02);
 * ini hanya umpan balik cepat, server tetap penegak akhir. `null` = lolos. */
export function newPasswordProblem(password: string, confirmation: string): string | null {
  const violation = passwordPolicyViolation(password);
  if (violation === "TOO_SHORT") return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  if (violation === "MISSING_LETTER_OR_DIGIT") return "Password harus mengandung huruf dan angka.";
  if (password !== confirmation) return "Konfirmasi password tidak sama.";
  return null;
}
