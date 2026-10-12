import { test } from "@playwright/test";
import { scanAccessibility, type KnownA11yIssue } from "../support/axe";

/** Pemindaian aksesibilitas otomatis (axe-core) untuk halaman admin. Aplikasi admin masih tampilan dasar; temuan ringan dicatat saja. */

/** Temuan awal saat kit ini dibuat: label peran admin di menu (teks abu-abu muda) kurang kontras terhadap latar putih. */
const DIKETAHUI: KnownA11yIssue[] = [
  { aturan: "color-contrast", target: ".ml-1", alasan: "label peran admin di menu memakai abu-abu terlalu muda (kurang dari 4,5:1)" },
];

const HALAMAN: Array<[string, string]> = [
  ["dashboard", "/"],
  ["undangan", "/invitations"],
  ["kelas", "/classes"],
  ["murid", "/students"],
  ["pengaturan", "/settings"],
];

test.describe("Aksesibilitas admin (axe)", { tag: "@a11y" }, () => {
  for (const [nama, alamat] of HALAMAN) {
    test(`[TC-AX-03] ${nama}: tidak ada pelanggaran WCAG A/AA tingkat serius atau kritis`, async ({ page }, testInfo) => {
      await page.goto(alamat);
      await page.locator("main").waitFor();
      await page.waitForLoadState("networkidle");
      await scanAccessibility(page, testInfo, `admin-${nama}`, DIKETAHUI);
    });
  }
});
