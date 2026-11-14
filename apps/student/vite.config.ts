import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { THEME } from "./theme";

/** Warna bilah alamat/status peramban (`<meta name="theme-color">` di index.html) diambil dari tema aktif, bukan ditulis mati. */
const themeColorMeta: Plugin = {
  name: "student-theme-color",
  transformIndexHtml: { order: "pre", handler: (html) => html.replace("%THEME_COLOR%", THEME.primary[700]) },
};

// PWA is configured for installability only — precache the app shell
// (HTML/JS/CSS) via the default `generateSW` globbing. Deliberately NO
// `workbox.runtimeCaching` rules for API responses or lesson/audio content:
// this app has zero offline-content support by design (PRD: online-only,
// install-to-homescreen convenience only, not offline function).
export default defineConfig({
  plugins: [
    react(),
    themeColorMeta,
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      manifest: {
        name: "Belajar Bahasa Jepang",
        short_name: "BahasaJepang",
        start_url: "/",
        display: "standalone",
        // Selaras dengan tema warna aplikasi (theme.ts): latar layar pembuka dan warna bilah status.
        background_color: THEME.secondary[50],
        theme_color: THEME.primary[700],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  // @elearning/domain SENGAJA di-compile CommonJS (bukan ESM) -- dibutuhkan
  // apps/api (NestJS, `require()` murni di produksi, lihat komentar di
  // packages/domain/package.json/tsconfig.json soal kenapa). Vite dev
  // server men-serve workspace package yang di-LINK (symlink pnpm) sebagai
  // source MENTAH secara default (bukan lewat esbuild pre-bundle seperti
  // dependency node_modules biasa) -- untuk paket CJS itu artinya `import {X}`
  // gagal ("does not provide an export named"), karena tidak ada transform
  // CJS->ESM interop yang jalan. `optimizeDeps.include` memaksa esbuild
  // memproses paket ini juga (dapat interop-nya), TANPA perlu mengubah
  // build packages/domain sendiri sama sekali (yang akan merusak apps/api).
  optimizeDeps: {
    include: ["@elearning/domain"],
  },
  build: {
    // Build PRODUKSI tidak lewat jalur `optimizeDeps` di atas, dan plugin commonjs bawaan Vite
    // hanya memproses `node_modules` -- padahal @elearning/domain di-LINK (path aslinya
    // packages/domain/dist, di luar node_modules). Tanpa baris ini Rollup menganggap dist CJS
    // itu tak punya export dan `vite build` gagal: "LessonSession" is not exported by ...
    // (sempat tidak ketahuan sejak halaman belajar dibuat; dijaga src/build.test.ts).
    commonjsOptions: { include: [/node_modules/, /packages[\\/]domain[\\/]dist/] },
  },
});
