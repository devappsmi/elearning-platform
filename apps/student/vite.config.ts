import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA is configured for installability only — precache the app shell
// (HTML/JS/CSS) via the default `generateSW` globbing. Deliberately NO
// `workbox.runtimeCaching` rules for API responses or lesson/audio content:
// this app has zero offline-content support by design (PRD: online-only,
// install-to-homescreen convenience only, not offline function).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      manifest: {
        name: "Belajar Bahasa Jepang",
        short_name: "BahasaJepang",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2563eb",
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
});
