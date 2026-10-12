import { dateKey, dateOnly } from "@elearning/domain";

/** Kunci minggu untuk leaderboard (GAM-05: "reset tiap Senin 00:00"). Waktu
 * LOKAL server -- konsisten dengan StreakService packages/domain yang juga
 * pakai waktu lokal (dateOnly/daysBetween), bukan UTC, supaya batas hari
 * streak dan batas minggu leaderboard tidak pernah saling selisih di sekitar
 * tengah malam kalau TZ server bukan UTC.
 *
 * Formatnya tanggal (YYYY-MM-DD) hari Senin TERBARU <= date -- bukan nomor
 * minggu ISO (menghindari edge-case penomoran minggu lintas tahun). Cukup
 * "minggu yang memuat date ini" sebagai kunci Redis yang otomatis berbeda
 * tiap Senin -- tidak perlu job terjadwal untuk "reset" secara eksplisit. */
export function weekKey(date: Date): string {
  const d = dateOnly(date);
  const day = d.getDay(); // 0=Minggu .. 6=Sabtu
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return dateKey(d);
}
