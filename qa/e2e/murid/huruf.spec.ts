import { expect, test } from "@playwright/test";
import { expectNoLeakedDebugText } from "../support/auth";

/** Halaman Huruf Jepang (pengantar + tabel kana) dan jalan masuknya. Kode [TC-..] = kasus di buku kasus uji. */

test.describe("Huruf Jepang", () => {
  test("[TC-BR-15] kartu pengantar huruf tampil hanya selama belum ada pelajaran yang selesai", async ({ page }) => {
    await page.goto("/");
    const selesai = page.getByText(/^Pelajaran selesai\s*\d+\/\d+$/);
    await expect(selesai).toBeVisible();
    const jumlah = Number(/(\d+)\//.exec(await selesai.innerText())![1]);
    const kartu = page.getByTestId("kana-intro-card");
    if (jumlah === 0) {
      await expect(kartu).toBeVisible();
      await kartu.getByRole("link", { name: "Baca pengantar" }).click();
      await expect(page).toHaveURL(/\/kana$/);
    } else {
      // Akun uji yang sudah pernah lulus pelajaran: kartu itu tidak boleh tampil lagi.
      await expect(kartu).toHaveCount(0);
    }
  });

  test("[TC-BR-16] pengantar dan tabel hiragana/katakana, dibuka dari spanduk unit dan dari Kamus", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("unit-kana-chart").first().click();
    await expect(page).toHaveURL(/\/kana\?tab=hiragana$/);
    await expect(page.getByTestId("kana-cell")).toHaveCount(104);
    await expect(page.getByTestId("kana-section-dasar").getByRole("columnheader")).toHaveText(["a", "i", "u", "e", "o"], { ignoreCase: true });
    const shi = page.getByTestId("kana-cell").filter({ hasText: "shi" }).first();
    await expect(shi).toContainText("し");
    await expect(shi).toContainText("tidak mengikuti pola baris");

    await page.getByTestId("kana-tab-katakana").click();
    await expect(page.getByTestId("kana-cell").first()).toContainText("ア");
    await expect(page.getByTestId("kana-cell").filter({ hasText: "kya" })).toContainText("キャ");

    await page.getByTestId("kana-tab-pengantar").click();
    await expect(page.getByRole("heading", { name: "Tiga jenis huruf" })).toBeVisible();
    await expect(page.getByTestId("example-sentence").locator("rt")).toHaveText(["わたし", "じん"]);
    await expectNoLeakedDebugText(page);

    await page.goto("/dictionary");
    await page.getByTestId("open-kana-chart").click();
    await expect(page).toHaveURL(/\/kana\?tab=hiragana$/);
    await expect(page.getByTestId("kana-cell")).toHaveCount(104);
  });
});
