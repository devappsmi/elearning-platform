import * as path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { cfg } from "./e2e/support/env";

const auth = (name: string): string => path.resolve(__dirname, ".auth", name);

/**
 * Pengaturan uji browser. Semua alamat dan akun dibaca dari `qa/.env` (lihat `.env.example`).
 *
 * Proyek:
 *  - murid-publik : halaman murid yang tidak butuh login (masuk, lupa password, tautan undangan).
 *  - murid        : aplikasi murid di komputer, memakai sesi hasil login sekali di awal.
 *  - murid-ponsel : sebagian uji murid di layar ponsel (Pixel 7).
 *  - admin-publik : halaman masuk admin.
 *  - admin        : aplikasi admin, memakai sesi hasil login sekali di awal.
 * Satu pekerja saja (urut) supaya data uji tidak saling menimpa dan pembatas permintaan server tidak terpicu.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./reports/artefak",
  timeout: 150_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: cfg.retries,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/html", open: "never" }],
    ["json", { outputFile: "reports/hasil.json" }],
  ],
  use: {
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    headless: !cfg.headed,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { slowMo: cfg.slowMo },
  },
  projects: [
    { name: "setup-murid", testMatch: /setup\/murid\.setup\.ts/, use: { baseURL: cfg.studentUrl } },
    { name: "setup-admin", testMatch: /setup\/admin\.setup\.ts/, use: { baseURL: cfg.adminUrl } },
    {
      name: "murid-publik",
      testMatch: /murid-publik\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: cfg.studentUrl },
    },
    {
      name: "murid",
      testMatch: /murid\/(?!.*\.ponsel\.).*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: cfg.studentUrl, storageState: auth("murid.json") },
      dependencies: ["setup-murid"],
    },
    {
      name: "murid-ponsel",
      testMatch: /murid\/.*\.ponsel\.spec\.ts/,
      use: { ...devices["Pixel 7"], baseURL: cfg.studentUrl, storageState: auth("murid.json") },
      dependencies: ["setup-murid"],
    },
    {
      name: "admin-publik",
      testMatch: /admin-publik\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: cfg.adminUrl },
    },
    {
      name: "admin",
      testMatch: /admin\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: cfg.adminUrl, storageState: auth("admin.json") },
      dependencies: ["setup-admin"],
    },
  ],
});
