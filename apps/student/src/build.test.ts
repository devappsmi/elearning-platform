// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { describe, expect, it } from "vitest";

// Penjaga build PRODUKSI. CI hanya menjalankan lint/typecheck/test, jadi `vite build` bisa
// rusak tanpa ada yang tahu -- dan memang pernah: sejak halaman belajar mengimpor
// @elearning/domain (CommonJS hasil tsc, di-LINK di luar node_modules), Rollup menolak
// `"LessonSession" is not exported by ...` karena plugin commonjs tidak memprosesnya.
// Dev server tidak terpengaruh (memakai pre-bundle esbuild), jadi kerusakannya baru terlihat
// saat build. Tes ini menjalankan build sungguhan (config asli, output ke folder sementara).

const appRoot = fileURLToPath(new URL("..", import.meta.url));

describe("build produksi", () => {
  it("berhasil dan memuat kode @elearning/domain (interop CommonJS)", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "student-build-"));
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production"; // vitest menyetelnya ke "test"; build sungguhan tidak
    try {
      await build({ root: appRoot, logLevel: "silent", build: { outDir, emptyOutDir: true } });

      const assets = join(outDir, "assets");
      const scripts = readdirSync(assets).filter((file) => file.endsWith(".js"));
      expect(scripts.length).toBeGreaterThan(0);
      const bundle = scripts.map((file) => readFileSync(join(assets, file), "utf8")).join("\n");

      // Regex aturan password HANYA ada di @elearning/domain (passwordPolicy) -- ada di bundel
      // berarti ekspor domain benar-benar terhubung, bukan sekadar build yang lolos.
      expect(bundle).toContain("(?=.*[A-Za-z])(?=.*\\d)");
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 120_000);
});
