import { expect, test } from "@playwright/test";
import { expectNoLeakedDebugText } from "../support/auth";
import { cfg } from "../support/env";

/** Admin: Dashboard, menu, dan keluar. Kode [TC-..] = kasus di buku kasus uji. */

test.describe("Dashboard admin", () => {
  test("[TC-AD-06] Dashboard menampilkan tiga angka ringkasan, distribusi streak, dan penyelesaian per kelas", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/");
    for (const label of ["Murid aktif minggu ini", "Total murid aktif", "Rata-rata XP"]) {
      const kartu = page.getByText(label, { exact: true });
      await expect(kartu).toBeVisible();
      const nilai = (await kartu.locator("xpath=following-sibling::p").innerText()).trim();
      expect(nilai, `Angka "${label}" harus berupa bilangan`).toMatch(/^\d+(\.\d+)?$/);
    }
    await expect(page.getByRole("heading", { name: "Distribusi Streak" })).toBeVisible();
    for (const kelompok of ["0", "1-3", "4-7", "8-14", "15-30", "30+"]) await expect(page.getByText(kelompok, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tingkat Penyelesaian Lesson per Kelas" })).toBeVisible();
    await expect(page.getByRole("table").or(page.getByText("Belum ada kelas aktif."))).toBeVisible();
    await expectNoLeakedDebugText(page);
  });

  test("[TC-AD-07] menu admin membuka semua halamannya dan sesi bertahan setelah muat ulang", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("navigation");
    for (const [nama, url] of [["Undangan", /\/invitations$/], ["Kelas", /\/classes$/], ["Murid", /\/students$/], ["Pengaturan", /\/settings$/], ["Dashboard", /\/$/]] as const) {
      await menu.getByRole("link", { name: nama, exact: true }).click();
      await expect(page, `Menu ${nama} seharusnya membuka ${url}`).toHaveURL(url);
    }
    await page.goto("/classes");
    await page.reload();
    await expect(page).toHaveURL(/\/classes$/);
    await expect(page.getByRole("heading", { name: "Buat Kelas Baru" })).toBeVisible();
  });

  test("[TC-AD-08] tombol Keluar mengakhiri sesi admin dan halaman admin tidak bisa dibuka lagi", async ({ browser }) => {
    test.skip(!cfg.admin.email, "QA_ADMIN_EMAIL belum diisi");
    // Sesi sendiri yang kosong supaya keluar di sini tidak mengganggu uji admin lain.
    const context = await browser.newContext({ baseURL: cfg.adminUrl, locale: "id-ID", storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill(cfg.admin.email);
      await page.getByLabel("Password").fill(cfg.admin.password);
      await page.getByRole("button", { name: "Masuk", exact: true }).click();
      await expect(page.getByText("Murid aktif minggu ini")).toBeVisible();
      await page.getByRole("button", { name: "Keluar" }).click();
      await expect(page).toHaveURL(/\/login/);
      await page.goto("/students");
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await context.close();
    }
  });

  test("[TC-AD-09] halaman Pengaturan belum tersedia dan menyatakannya dengan jelas", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Pengaturan" })).toBeVisible();
    await expect(page.getByText("Halaman ini belum diimplementasikan.")).toBeVisible();
  });
});
