import { dateKey } from "@elearning/domain";

/** Kunci counter kuota harian -- format `tutor_quota:{userId}:{tanggal}`
 * persis rencana di docs/PLAN.md bagian 6. Tanggal = hari LOKAL server
 * (`dateKey`), konsisten dengan streak dan kunci minggu leaderboard
 * (lihat week.util.ts) -- kuota "reset per hari lokal" seperti versi lama. */
export function quotaKey(userId: string, now: Date): string {
  return `tutor_quota:${userId}:${dateKey(now)}`;
}

/** Tengah malam lokal BERIKUTNYA -- kapan kuota reset. Dibangun lewat
 * komponen kalender (bukan `+ 24 jam`) supaya benar di hari transisi DST. */
export function nextLocalMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** TTL key Redis: hidup sampai tengah malam lokal berikutnya, minimal 1 detik
 * (EXPIRE 0 menghapus key seketika). */
export function secondsUntilNextMidnight(now: Date): number {
  return Math.max(1, Math.ceil((nextLocalMidnight(now).getTime() - now.getTime()) / 1000));
}
