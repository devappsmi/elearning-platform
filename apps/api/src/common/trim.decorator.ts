import { Transform } from "class-transformer";

/** Buang spasi di tepi string SEBELUM divalidasi (`@Transform` jalan sebelum
 * class-validator) -- tanpa ini `@MinLength(1)` meloloskan "   ", nama yang
 * kosong secara visual. Nilai yang bukan string dibiarkan apa adanya supaya
 * `@IsString()` yang menolaknya dengan pesan yang benar.
 *
 * Pakai HANYA untuk teks bebas seperti nama. JANGAN di password (spasi sah
 * di dalam/tepi password) atau token. */
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value));
}
