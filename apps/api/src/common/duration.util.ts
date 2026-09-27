/** Parse durasi ala JWT ("14d", "1h") jadi Date. Dipakai untuk kolom
 * expiresAt di tabel refresh-token (bukan untuk verifikasi -- itu tugas
 * JwtService sendiri lewat signature+exp claim); DB expiresAt cuma dipakai
 * operator untuk query "token yang sudah lewat masa berlaku" tanpa perlu
 * decode JWT-nya. */
export function addDuration(base: Date, duration: string): Date {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`Format durasi tidak dikenali: ${duration}`);
  // Destructuring RegExpExecArray (~string[]) di bawah noUncheckedIndexedAccess
  // membuat tiap elemen bertipe `string | undefined` walau regex-nya sendiri
  // menjamin keduanya ada kalau `match` tidak null -- non-null assertion di
  // sini sengaja, bukan diagnosa yang diabaikan.
  const [, amountStr, unit] = match;
  const amount = Number(amountStr);
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(base.getTime() + amount * unitMs[unit!]!);
}
