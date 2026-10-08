import { test } from "@playwright/test";
import { scanAccessibility } from "../support/axe";
import { waitForExercise } from "../support/lesson";

/**
 * Pemindaian aksesibilitas otomatis (axe-core) untuk halaman murid yang butuh login. Pemindaian otomatis hanya menangkap
 * sebagian masalah (kira-kira sepertiga); pemeriksaan keyboard dan pembaca layar tetap manual (lihat kasus TC-AX-*).
 */

const HALAMAN: Array<[string, string]> = [
  ["beranda", "/"],
  ["percakapan", "/conversation"],
  ["pengantar-skenario", "/conversation/perkenalan"],
  ["ngobrol-ai", "/conversation/ngobrol-ai"],
  ["kamus", "/dictionary"],
  ["flashcard", "/flashcards"],
  ["leaderboard", "/leaderboard"],
  ["profil", "/profile"],
  ["welcome", "/welcome"],
];

test.describe("Aksesibilitas (axe)", { tag: "@a11y" }, () => {
  for (const [nama, alamat] of HALAMAN) {
    test(`[TC-AX-01] ${nama}: tidak ada pelanggaran WCAG A/AA tingkat serius atau kritis`, async ({ page }, testInfo) => {
      await page.goto(alamat);
      await page.locator("main, h1").first().waitFor();
      await scanAccessibility(page, testInfo, nama);
    });
  }

  test("[TC-AX-01] layar pelajaran: tidak ada pelanggaran WCAG A/AA tingkat serius atau kritis", async ({ page }, testInfo) => {
    await page.goto("/learn/l1");
    await waitForExercise(page);
    await scanAccessibility(page, testInfo, "pelajaran");
  });
});
