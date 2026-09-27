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
});
