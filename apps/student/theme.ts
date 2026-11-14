import colors from "tailwindcss/colors";

/**
 * TEMA WARNA aplikasi murid -- SATU-SATUNYA tempat warna merek ditentukan.
 *
 * Merek = tiga keluarga warna (masing-masing skala 50-950) yang dipakai kelas Tailwind `primary-*`, `secondary-*`,
 * dan `tertiary-*` di seluruh `src/`:
 *   primary   ujung AWAL gradien merek (tombol utama, spanduk, sidebar atas, kilau latar kiri)
 *   secondary warna merek UTAMA: tautan, cincin fokus, semburat kartu, chip, kilau latar kanan-atas, ubin ikon
 *   tertiary  ujung AKHIR gradien merek
 * Gradien merek selalu `primary -> secondary -> tertiary` (mis. `from-primary-600 via-secondary-600 to-tertiary-600`).
 * Yang TIDAK ikut tema (sengaja): warna makna -- hijau = benar, merah = salah, kuning = streak/matahari -- dan aksen
 * "sakura" (pink) untuk Percakapan dan lambang aplikasi.
 *
 * Ganti tema: ubah `DEFAULT_THEME` di bawah (lalu restart `vite` dev; build produksi otomatis ikut). Untuk mencoba tema lain
 * tanpa mengubah berkas: `STUDENT_THEME=matcha pnpm --filter student dev` (nama tema valid = kunci `THEMES`).
 * Berkas ini hanya dibaca oleh konfigurasi (Tailwind, Vite) -- JANGAN diimpor dari `src/`.
 *
 * Aturan kontras (teks putih di atas gradien dan tombol harus >= 4,5:1): keluarga warna TERANG (sky, teal, emerald, green,
 * lime, orange) baru memenuhinya mulai shade 700, jadi dibungkus `darker()` yang menggeser peran 500-700 satu langkah lebih
 * gelap. Sesudah mengubah tema, jalankan ulang tes dan cek kontras di browser.
 */
/** Skala satu keluarga warna: shade -> hex. (Tipe palet bawaan Tailwind berupa literal per warna, jadi tidak bisa dipakai di sini.) */
type Palette = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>;

/** Geser peran 500/600/700/800 ke shade satu langkah lebih gelap (500->600 ... 800->900); 50-400 dan 900-950 tetap. */
function darker(p: Palette): Palette {
  return { 50: p[50], 100: p[100], 200: p[200], 300: p[300], 400: p[400], 500: p[600], 600: p[700], 700: p[800], 800: p[900], 900: p[900], 950: p[950] };
}

export interface Theme {
  nama: string;
  kesan: string;
  primary: Palette;
  secondary: Palette;
  tertiary: Palette;
}

export const THEMES = {
  samudra: {
    nama: "Biru Samudra",
    kesan: "Segar, tenang, terpercaya",
    primary: colors.blue,
    secondary: darker(colors.sky),
    tertiary: darker(colors.teal),
  },
  ungu: {
    nama: "Ungu Sakura",
    kesan: "Ceria dan playful (tampilan awal)",
    primary: colors.indigo,
    secondary: colors.violet,
    tertiary: colors.fuchsia,
  },
  matcha: {
    nama: "Hijau Matcha",
    kesan: "Alami dan menenangkan",
    primary: darker(colors.emerald),
    secondary: darker(colors.green),
    tertiary: darker(colors.lime),
  },
  senja: {
    nama: "Jingga Senja",
    kesan: "Hangat seperti langit sore",
    primary: darker(colors.orange),
    secondary: colors.rose,
    tertiary: colors.violet,
  },
  permen: {
    nama: "Pink Permen",
    kesan: "Manis dan bersahabat",
    primary: colors.fuchsia,
    secondary: colors.pink,
    tertiary: colors.rose,
  },
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

/** Tema yang dipakai bila `STUDENT_THEME` tidak diisi. */
const DEFAULT_THEME: ThemeName = "samudra";

function resolveThemeName(): ThemeName {
  const wanted = process.env.STUDENT_THEME;
  if (!wanted) return DEFAULT_THEME;
  if (wanted in THEMES) return wanted as ThemeName;
  throw new Error(`STUDENT_THEME="${wanted}" tidak dikenal. Pilihan: ${Object.keys(THEMES).join(", ")}`);
}

export const THEME_NAME: ThemeName = resolveThemeName();
export const THEME: Theme = THEMES[THEME_NAME];

/** "#rrggbb" + alfa -> "rgb(r g b / a)" (untuk bayangan dan keyframes di konfigurasi Tailwind). */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`;
}
