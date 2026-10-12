import { expect, test } from "@playwright/test";
import { expectNoLeakedDebugText } from "../support/auth";

/** Tes penempatan (PRD AUTH-05) dari sisi murid uji utama. Akun ini biasanya sudah menyelesaikan pelajaran, jadi tes tidak
 *  lagi ditawarkan; uji ini memeriksa kedua kemungkinan tanpa mengubah apa pun (tes tidak dimulai). Alur mengerjakan tes
 *  ada di murid-publik/penempatan-murid-baru.spec.ts (butuh akun baru). Kode [TC-..] = kasus di buku kasus uji. */

test.describe("Tes penempatan", () => {
  test("[TC-AK-32] tawaran hanya untuk murid yang belum mulai; selain itu halaman tes tidak bisa dimulai", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/^Pelajaran selesai\s*\d+\/\d+$/)).toBeVisible();
    const offer = page.getByTestId("placement-offer-card");
    // Tawaran dimuat terpisah dari jalur belajar: beri waktu sejenak sebelum menyimpulkan tidak ada.
    await page.waitForLoadState("networkidle");

    if (await offer.isVisible()) {
      test.info().annotations.push({ type: "catatan", description: "Akun uji belum pernah belajar: tawaran tampil, tes TIDAK dimulai." });
      await offer.getByRole("link", { name: "Ikut tes" }).click();
      await expect(page.getByTestId("placement-intro")).toContainText("hanya bisa diambil sekali");
      await page.getByTestId("placement-skip").click();
      await expect(page).toHaveURL(/\/$/);
      return;
    }

    await page.goto("/placement");
    const taken = page.getByTestId("placement-taken");
    const unavailable = page.getByTestId("placement-unavailable");
    await expect(taken.or(unavailable)).toBeVisible();
    await expect(page.getByTestId("placement-start")).toHaveCount(0);
    await expectNoLeakedDebugText(page);

    // Unit yang dilewati (bila akun ini pernah lulus tes) tidak lagi disodori pengantar huruf.
    await page.goto("/");
    await expect(page.getByText(/^Pelajaran selesai/)).toBeVisible();
    if ((await page.getByTestId("unit-skipped").count()) > 0) await expect(page.getByTestId("kana-intro-card")).toHaveCount(0);
  });
});
