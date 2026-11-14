import preset from "@elearning/config/tailwind";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  // packages/ui HARUS ikut dipindai: kelas yang hanya dipakai di dalamnya (mis. `text-white px-4`
  // pada Button) tidak akan dibuat Tailwind kalau tidak -- tombol tampil hitam-di-atas-biru tanpa padding.
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};
