import { defineConfig } from "vitest/config";

/** Verifikasi LIVE terhadap penyedia sungguhan (OpenAI) -- BUKAN bagian `pnpm test`/CI:
 * berkasnya berakhiran `.live.ts` (tidak cocok dengan `include` di vitest.config.ts) dan
 * dijalankan hanya lewat `pnpm --filter api run test:live-openai` dengan OPENAI_API_KEY
 * sungguhan. Memanggil API berbayar (beberapa sen per proses), maka berjalan berurutan. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.live.ts"],
    testTimeout: 90_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
