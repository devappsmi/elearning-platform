import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// No vite-plugin-pwa here — admin has no PWA requirement per the plan.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
});
