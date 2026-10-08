import { test } from "@playwright/test";
import { scanAccessibility } from "../support/axe";

/** Pemindaian aksesibilitas otomatis (axe-core) untuk halaman murid yang tidak butuh login. */

const HALAMAN: Array<[string, string]> = [
  ["masuk", "/login"],
  ["lupa-password", "/forgot-password"],
  ["reset-password", "/reset-password/token-contoh"],
  ["undangan-tidak-valid", "/invite/token-contoh"],
];

test.describe("Aksesibilitas halaman publik (axe)", { tag: "@a11y" }, () => {
  for (const [nama, alamat] of HALAMAN) {
    test(`[TC-AX-02] ${nama}: tidak ada pelanggaran WCAG A/AA tingkat serius atau kritis`, async ({ page }, testInfo) => {
      await page.goto(alamat);
      await page.locator("h1").first().waitFor();
      await scanAccessibility(page, testInfo, nama);
    });
  }
});
