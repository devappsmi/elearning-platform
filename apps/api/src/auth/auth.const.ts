/** Batas permintaan reset password (`POST /auth/forgot`) -- docs/PLAN.md bagian 6f.
 *
 * Endpoint ini memicu EMAIL ke alamat yang ditentukan pemanggil tanpa login,
 * jadi dua batas berlapis dengan tujuan berbeda:
 * - per ALAMAT email (Redis, semua klien digabung): mencegah kotak surat satu
 *   orang dibanjiri. Melebihi batas = TIDAK dikirim, tapi jawabannya tetap 200
 *   yang sama persis (anti-enumerasi: tidak boleh membedakan "dibatasi" dari
 *   "terkirim" maupun dari "email tak terdaftar").
 * - per IP (`@Throttle`, 429): mencegah satu klien menyemprot banyak alamat
 *   (biaya + reputasi pengirim). Cukup longgar untuk satu kelas di belakang NAT
 *   yang sama. Penyimpanannya di memori proses -- kalau API dijalankan lebih dari
 *   satu instance, pindahkan ke storage Redis milik throttler. */
export const FORGOT_EMAIL_LIMIT = 3;
export const FORGOT_EMAIL_WINDOW_SECONDS = 60 * 60;
export const FORGOT_IP_LIMIT = 30;
export const FORGOT_IP_WINDOW_MS = 60 * 60 * 1000;
