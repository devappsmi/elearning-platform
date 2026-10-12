import { expect, test, type Page } from "@playwright/test";
import { cfg } from "../support/env";

/**
 * Admin: Kelas. Kelas uji dibuat dengan nama berawalan QA_PREFIX dan diarsipkan di akhir
 * (kelas tidak bisa dihapus dari aplikasi, hanya diarsipkan). Kode [TC-..] = kasus di buku kasus uji.
 */

const NAMA_KELAS = `${cfg.prefix} Kelas ${Date.now()}`;

function barisKelas(page: Page, nama: string) {
  return page.locator("tr", { hasText: nama });
}

test.describe.serial("Kelas", () => {
  test("[TC-AD-10] membuat kelas baru: muncul di daftar dengan status Aktif dan 0 murid", async ({ page }) => {
    await page.goto("/classes");
    await expect(page.getByRole("heading", { name: "Buat Kelas Baru" })).toBeVisible();
    await page.getByLabel("Nama Kelas").fill(NAMA_KELAS);
    await page.getByLabel("Deskripsi (opsional)").fill("Dibuat oleh uji otomatis QA");
    await page.getByRole("button", { name: "Buat Kelas" }).click();
    const baris = barisKelas(page, NAMA_KELAS);
    await expect(baris).toBeVisible();
    await expect(baris.getByText("Aktif", { exact: true })).toBeVisible();
    await expect(baris.locator("td").nth(1)).toHaveText("0");
    await expect(baris.getByRole("button", { name: "Arsipkan" })).toBeVisible();
    // Formulir dikosongkan lagi setelah berhasil.
    await expect(page.getByLabel("Nama Kelas")).toHaveValue("");
  });

  test("[TC-AD-11] nama kelas wajib diisi dan tidak ada kelas kosong yang terbentuk", async ({ page }) => {
    await page.goto("/classes");
    await expect(page.getByRole("heading", { name: "Buat Kelas Baru" })).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    const sebelum = await page.locator("tbody tr").count();
    await page.getByRole("button", { name: "Buat Kelas" }).click();
    expect(await page.getByLabel("Nama Kelas").evaluate((el) => (el as HTMLInputElement).validity.valueMissing)).toBe(true);
    // Nama yang hanya spasi: boleh ditolak (pesan gagal) atau dipangkas, tetapi tidak boleh membuat baris tanpa nama.
    await page.getByLabel("Nama Kelas").fill("     ");
    await page.getByRole("button", { name: "Buat Kelas" }).click();
    await page.waitForTimeout(800);
    const sesudah = await page.locator("tbody tr").count();
    if (sesudah > sebelum) {
      const namaKosong = await page.locator("tbody tr").evaluateAll((rows) => rows.filter((r) => (r.querySelector("td")?.textContent ?? "").trim() === "").length);
      expect(namaKosong, "Tidak boleh ada kelas dengan nama kosong").toBe(0);
    }
  });

  test("[TC-AD-12] kelas yang diarsipkan hilang dari pilihan kelas undangan tetapi tetap ada di filter", async ({ page }) => {
    await page.goto("/classes");
    await barisKelas(page, NAMA_KELAS).getByRole("button", { name: "Arsipkan" }).click();
    const baris = barisKelas(page, NAMA_KELAS);
    await expect(baris.getByText("Diarsipkan", { exact: true })).toBeVisible();
    await expect(baris.getByRole("button", { name: "Buka Arsip" })).toBeVisible();

    await page.goto("/invitations");
    await expect(page.getByLabel("Kelas", { exact: true })).toBeVisible();
    await expect(page.locator("#filter-class")).toBeVisible();
    await expect(page.locator("#inv-class option", { hasText: NAMA_KELAS })).toHaveCount(0);
    await expect(page.locator("#filter-class option", { hasText: NAMA_KELAS })).toHaveCount(1);
  });

  test("[TC-AD-13] membuka arsip mengembalikan kelas ke status Aktif dan ke pilihan undangan", async ({ page }) => {
    await page.goto("/classes");
    await barisKelas(page, NAMA_KELAS).getByRole("button", { name: "Buka Arsip" }).click();
    await expect(barisKelas(page, NAMA_KELAS).getByText("Aktif", { exact: true })).toBeVisible();
    await page.goto("/invitations");
    await expect(page.locator("#inv-class option", { hasText: NAMA_KELAS })).toHaveCount(1);
  });

  test.afterAll(async ({ browser }) => {
    // Bersih-bersih: arsipkan kelas uji supaya tidak menumpuk di daftar kelas aktif.
    const context = await browser.newContext({ baseURL: cfg.adminUrl });
    const page = await context.newPage();
    try {
      await page.goto("/classes");
      const arsipkan = barisKelas(page, NAMA_KELAS).getByRole("button", { name: "Arsipkan" });
      if (await arsipkan.isVisible({ timeout: 5000 }).catch(() => false)) await arsipkan.click();
    } finally {
      await context.close();
    }
  });
});
