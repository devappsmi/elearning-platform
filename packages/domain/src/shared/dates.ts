/** Utilitas tanggal kalender (tanpa jam). Port dari lib/core/utils/dates.dart. */

export function dateKey(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Selisih hari kalender dari `from` ke `to`. Negatif jika `to` lebih awal.
 * Dibulatkan (bukan dipotong) supaya transisi DST tidak menggeser hasil --
 * versi Dart-nya pakai pemotongan integer (Duration.inDays). */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000;
  return Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / msPerDay);
}
