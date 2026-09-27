/** Menentukan pesan sapaan maskot berdasarkan progres hari ini. Fungsi murni
 * supaya mudah dites tanpa merender komponen. Port dari
 * lib/features/home/mascot_greeting.dart. */
export function mascotMessage({ goalReachedToday, streak }: { goalReachedToday: boolean; streak: number }): string {
  if (goalReachedToday) return 'Target harian tercapai. Sampai jumpa besok.';
  if (streak === 0) return 'Mulai hari ini untuk memulai streak-mu.';
  return 'Ayo lanjutkan, jangan putus streak-mu.';
}
