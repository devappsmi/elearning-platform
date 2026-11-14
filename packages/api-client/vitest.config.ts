import { defineConfig } from "vitest/config";

// fetch/Request/Headers/Response global Node modern (undici) sudah cukup
// untuk menguji client.ts -- tidak perlu jsdom (tes tidak pernah menyentuh
// localStorage, TokenStorage dipalsukan langsung di tes lewat objek biasa).
export default defineConfig({
  test: {
    environment: "node",
  },
});
