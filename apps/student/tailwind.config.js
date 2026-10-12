import preset from "@elearning/config/tailwind";
import { THEME, withAlpha } from "./theme.ts";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  // Aplikasi murid punya komponen sendiri (src/components/ui) dan tidak memakai packages/ui. Kalau suatu saat
  // ada yang diimpor dari @elearning/ui, tambahkan "../../packages/ui/src/**/*.{ts,tsx}" di sini: kelas yang
  // hanya dipakai di dalam paket itu tidak akan dibuat Tailwind kalau tidak dipindai (tombol tampil tanpa gaya).
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Warna merek: primary/secondary/tertiary dari tema aktif (theme.ts -- satu-satunya tempat mengganti warna merek).
      colors: {
        primary: THEME.primary,
        secondary: THEME.secondary,
        tertiary: THEME.tertiary,
      },
      // Nunito (dimuat lewat @fontsource-variable di main.tsx) untuk huruf Latin; aksara Jepang jatuh ke
      // font sistem yang bulat/rapi di tiap platform (urutan: Apple, Windows, Android/Linux).
      fontFamily: {
        sans: [
          '"Nunito Variable"',
          "Nunito",
          "ui-rounded",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          '"Hiragino Maru Gothic ProN"',
          '"Hiragino Sans"',
          '"Yu Gothic UI"',
          '"Yu Gothic"',
          "Meiryo",
          '"Noto Sans JP"',
          '"Noto Sans CJK JP"',
          "sans-serif",
        ],
      },
      boxShadow: {
        // Bayangan lembut berwarna untuk kartu; "tepi" tombol (efek timbul ala permainan) dibuat per-varian di Button.
        card: `0 1px 2px ${withAlpha(THEME.secondary[900], 0.04)}, 0 12px 32px -14px ${withAlpha(THEME.primary[600], 0.28)}`,
        glow: `0 10px 30px -8px ${withAlpha(THEME.secondary[500], 0.55)}`,
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.92) translateY(6px)" },
          "70%": { opacity: "1", transform: "scale(1.02) translateY(0)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-5deg)" },
          "50%": { transform: "rotate(5deg)" },
        },
        flicker: {
          "0%, 100%": { transform: "scale(1) rotate(-3deg)" },
          "50%": { transform: "scale(1.14) rotate(4deg)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        sheen: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "ring-pulse": {
          "0%": { boxShadow: `0 0 0 0 ${withAlpha(THEME.secondary[500], 0.5)}` },
          "100%": { boxShadow: `0 0 0 18px ${withAlpha(THEME.secondary[500], 0)}` },
        },
        // Konfeti: tiap keping mengisi --dx (sisi) dan --rot (putaran) lewat style inline.
        confetti: {
          "0%": { transform: "translate3d(0, -12vh, 0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translate3d(var(--dx, 0px), 105vh, 0) rotate(var(--rot, 540deg))", opacity: "0.85" },
        },
      },
      // Tanpa fill-mode `forwards`: transform sisa dari keyframe akhir akan menjadikan elemen ini "wadah" bagi turunannya
      // yang `position: fixed` (mis. lapisan konfeti) sehingga posisinya salah.
      animation: {
        float: "float 4s ease-in-out infinite",
        "float-slow": "float 7s ease-in-out infinite",
        "pop-in": "pop-in 0.42s cubic-bezier(0.2, 0.9, 0.3, 1.2) backwards",
        "slide-up": "slide-up 0.45s ease-out backwards",
        wiggle: "wiggle 1.4s ease-in-out infinite",
        flicker: "flicker 1.6s ease-in-out infinite",
        shake: "shake 0.4s ease-in-out",
        sheen: "sheen 3.2s linear infinite",
        "ring-pulse": "ring-pulse 1.9s ease-out infinite",
        confetti: "confetti 3.4s ease-in forwards",
      },
    },
  },
};
