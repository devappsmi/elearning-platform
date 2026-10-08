import { expect, test } from "@playwright/test";
import { loginStudent } from "../support/auth";
import { cfg } from "../support/env";

/** Akun murid yang sudah masuk: sesi, keluar, dan onboarding. Kode [TC-..] = kasus di buku kasus uji. */

test.describe("Sesi dan keluar", () => {
  test("[TC-AK-12] sesi bertahan setelah halaman dimuat ulang dan setelah pindah halaman", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/");
    const sapaan = page.getByRole("heading", { name: /^Selamat datang,/ });
    await expect(sapaan).toBeVisible();

    await page.reload();
    await expect(sapaan).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profil", exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("[TC-AK-21] tombol Keluar mengakhiri sesi dan halaman belajar tidak bisa dibuka lagi", async ({ browser }) => {
    test.skip(!cfg.student.email, "QA_STUDENT_EMAIL belum diisi");
    // Memakai sesi sendiri yang benar-benar kosong (bukan sesi bersama) supaya keluar di sini tidak mengganggu uji lain.
    const context = await browser.newContext({
      baseURL: cfg.studentUrl,
      locale: "id-ID",
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    try {
      await loginStudent(page);
      await expect(page.getByRole("heading", { name: /^Selamat datang,/ })).toBeVisible();

      await page.getByRole("button", { name: "Keluar" }).first().click();
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();

      // Alamat belajar yang dibuka langsung sesudah keluar tidak boleh memperlihatkan isi.
      await page.goto("/");
      await expect(page).toHaveURL(/\/login/);
      await page.goto("/learn/l1");
      await expect(page).toHaveURL(/\/login/);

      const tokens = await page.evaluate(() => Object.keys(localStorage).filter((key) => /token/i.test(key)));
      expect(tokens, "Token masuk seharusnya sudah dihapus dari penyimpanan peramban").toEqual([]);
    } finally {
      await context.close();
    }
  });
});

test.describe("Onboarding /welcome", () => {
  test("[TC-AK-07] layar sambutan 3 langkah bisa dilalui maju dan mundur, lalu mengarah ke Beranda", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page.getByTestId("welcome-progress")).toHaveText("Langkah 1 dari 3");
    await expect(page.getByRole("heading", { name: /^Selamat datang, / })).toBeVisible();
    // Tiga pilihan target harian, satu sudah terpilih.
    await expect(page.getByRole("radio")).toHaveCount(3);
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(1);

    await page.getByRole("button", { name: "Lanjut" }).click();
    await expect(page.getByTestId("welcome-progress")).toHaveText("Langkah 2 dari 3");
    await expect(page.getByRole("heading", { name: "Jalur belajarmu" })).toBeVisible();
    await expect(page.getByTestId("welcome-levels").getByRole("listitem").first()).toContainText("mulai di sini");

    await page.getByRole("button", { name: "Lanjut" }).click();
    await expect(page.getByTestId("welcome-progress")).toHaveText("Langkah 3 dari 3");
    await expect(page.getByRole("heading", { name: "Siap mulai!" })).toBeVisible();
    await expect(page.getByTestId("welcome-summary-goal")).toHaveText(/^\d+ XP$/);

    // Mundur menjaga pilihan, lalu maju lagi sampai selesai.
    await page.getByRole("button", { name: "Kembali" }).click();
    await expect(page.getByTestId("welcome-progress")).toHaveText("Langkah 2 dari 3");
    await page.getByRole("button", { name: "Kembali" }).click();
    await expect(page.getByTestId("welcome-progress")).toHaveText("Langkah 1 dari 3");
    await page.getByRole("button", { name: "Lanjut" }).click();
    await page.getByRole("button", { name: "Lanjut" }).click();

    await page.getByRole("button", { name: "Mulai Belajar" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /^Selamat datang,/ })).toBeVisible();
  });
});
