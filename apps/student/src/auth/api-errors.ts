/** Ringkasan kegagalan panggilan API untuk form publik (registrasi, reset
 * password, dst.). Klien openapi-fetch mengembalikan `{ data, error, response }`
 * TANPA melempar untuk respons non-2xx; `error` adalah body JSON apa adanya
 * (tipenya tidak dideklarasikan di OpenAPI, jadi dibaca defensif di sini). */
export interface ApiFailure {
  status: number;
  /** `message` dari body error NestJS: `string` untuk error bisnis yang sudah
   * berbahasa Indonesia ("Undangan sudah kedaluwarsa"), `string[]` untuk error
   * validasi class-validator (bahasa Inggris -- TIDAK ditampilkan ke murid). */
  message: string | string[] | null;
}

export const NETWORK_ERROR_TEXT = "Tidak dapat menghubungi server. Periksa koneksi internetmu lalu coba lagi.";
export const INVALID_INPUT_TEXT = "Data yang dikirim tidak valid. Periksa kembali isianmu.";

export function readFailure(response: Response | undefined, error: unknown): ApiFailure {
  const raw = typeof error === "object" && error !== null && "message" in error ? (error as { message: unknown }).message : null;
  const message = typeof raw === "string" || Array.isArray(raw) ? (raw as string | string[]) : null;
  return { status: response?.status ?? 0, message };
}

/** Teks untuk murid. Hanya pesan bisnis `string` dari server yang diteruskan
 * (sudah Indonesia dan sengaja dirancang untuk dibaca pengguna); selain itu
 * teks tetap di sini, jadi error teknis (mis. "ThrottlerException", pesan
 * validasi Inggris) tidak pernah bocor ke layar. */
export function failureText(failure: ApiFailure, fallback: string): string {
  if (failure.status === 429) return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
  if (failure.status >= 500) return "Terjadi gangguan di server. Coba lagi sebentar lagi.";
  if (failure.status === 400 && typeof failure.message === "string") return failure.message;
  return fallback;
}
