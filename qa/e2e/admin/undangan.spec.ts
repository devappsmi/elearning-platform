import { expect, test, type Page } from "@playwright/test";
import { cfg } from "../support/env";

/**
 * Admin: Undangan murid. Email undangan uji memakai domain example.com dan berawalan QA_PREFIX. Email TIDAK benar-benar
 * terkirim (pengiriman email di server masih berupa catatan di log), jadi uji ini memeriksa status dan tombolnya saja.
 * Kode [TC-..] = kasus di buku kasus uji.
 */

const STAMP = Date.now();
const KELAS = `${cfg.prefix} Kelas Undangan ${STAMP}`;
const EMAIL = `${cfg.prefix.toLowerCase()}-undangan-${STAMP}@example.com`;
const NAMA = `${cfg.prefix} Undangan ${STAMP}`;

function baris(page: Page, email: string) {
  return page.locator("tr", { hasText: email });
}

async function kirimUndangan(page: Page, nama: string, email: string, kelas: string): Promise<void> {
  await page.getByLabel("Nama", { exact: true }).fill(nama);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("#inv-class").selectOption({ label: kelas });
  await page.getByRole("button", { name: "Kirim Undangan" }).click();
}

test.describe.serial("Undangan", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: cfg.adminUrl });
    const page = await context.newPage();
    try {
      await page.goto("/classes");
      await page.getByLabel("Nama Kelas").fill(KELAS);
      await page.getByRole("button", { name: "Buat Kelas" }).click();
      await expect(page.locator("tr", { hasText: KELAS })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("[TC-AD-14] membuat undangan: muncul berstatus Menunggu dengan tombol Kirim Ulang dan Cabut", async ({ page }) => {
    await page.goto("/invitations");
    await expect(page.getByRole("heading", { name: "Undang Murid Baru" })).toBeVisible();
    await kirimUndangan(page, NAMA, EMAIL, KELAS);
    const b = baris(page, EMAIL);
    await expect(b).toBeVisible();
    await expect(b).toContainText(NAMA);
    await expect(b).toContainText(KELAS);
    await expect(b.getByText("Menunggu", { exact: true })).toBeVisible();
    await expect(b.getByRole("button", { name: "Kirim Ulang" })).toBeVisible();
    await expect(b.getByRole("button", { name: "Cabut" })).toBeVisible();
    await expect(b.locator("td").nth(4)).toHaveText(/\d{1,2}\/\d{1,2}\/\d{4}/);
    // Formulir dikosongkan setelah berhasil.
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
  });

  test("[TC-AD-15] undangan kedua untuk email yang masih punya undangan aktif ditolak dengan pesan", async ({ page }) => {
    await page.goto("/invitations");
    await kirimUndangan(page, NAMA, EMAIL, KELAS);
    await expect(page.getByText(/Gagal mengirim undangan/)).toBeVisible();
    await expect(baris(page, EMAIL)).toHaveCount(1);
  });

  test("[TC-AD-16] undangan untuk email yang sudah terdaftar sebagai murid ditolak", async ({ page }) => {
    test.skip(!cfg.student.email, "QA_STUDENT_EMAIL belum diisi");
    await page.goto("/invitations");
    await kirimUndangan(page, "Murid Sudah Ada", cfg.student.email, KELAS);
    await expect(page.getByText(/Gagal mengirim undangan/)).toBeVisible();
    await expect(baris(page, cfg.student.email)).toHaveCount(0);
  });

  test("[TC-AD-17] formulir undangan menahan email berformat salah dan mewajibkan memilih kelas", async ({ page }) => {
    await page.goto("/invitations");
    await page.getByLabel("Nama", { exact: true }).fill("Tanpa Kelas");
    await page.getByLabel("Email", { exact: true }).fill("bukan-email");
    await page.getByRole("button", { name: "Kirim Undangan" }).click();
    expect(await page.getByLabel("Email", { exact: true }).evaluate((el) => (el as HTMLInputElement).validity.typeMismatch)).toBe(true);
    await page.getByLabel("Email", { exact: true }).fill(`${cfg.prefix.toLowerCase()}-tanpa-kelas-${STAMP}@example.com`);
    await page.getByRole("button", { name: "Kirim Undangan" }).click();
    expect(await page.locator("#inv-class").evaluate((el) => (el as HTMLSelectElement).validity.valueMissing)).toBe(true);
    await expect(baris(page, `tanpa-kelas-${STAMP}`)).toHaveCount(0);
  });

  test("[TC-AD-18] Kirim Ulang berhasil tanpa galat dan undangan tetap Menunggu", async ({ page }) => {
    await page.goto("/invitations");
    const b = baris(page, EMAIL);
    await expect(b).toBeVisible();
    await b.getByRole("button", { name: "Kirim Ulang" }).click();
    await expect(page.getByText("Gagal mengirim ulang undangan.")).toHaveCount(0);
    await expect(baris(page, EMAIL).getByText("Menunggu", { exact: true })).toBeVisible();
  });

  test("[TC-AD-19] filter status dan filter kelas menyaring daftar undangan", async ({ page }) => {
    await page.goto("/invitations");
    await expect(baris(page, EMAIL)).toBeVisible();
    await page.locator("#filter-status").selectOption("PENDING");
    await expect(baris(page, EMAIL)).toBeVisible();
    await page.locator("#filter-status").selectOption("ACCEPTED");
    await expect(baris(page, EMAIL)).toHaveCount(0);
    await page.locator("#filter-status").selectOption("");
    await page.locator("#filter-class").selectOption({ label: KELAS });
    await expect(baris(page, EMAIL)).toBeVisible();
    // Semua baris yang tampil harus dari kelas yang dipilih.
    const kelasBaris = await page.locator("tbody tr td:nth-child(3)").allInnerTexts();
    for (const kelas of kelasBaris) expect(kelas.trim()).toBe(KELAS);
  });

  test("[TC-AD-20] mencabut undangan meminta konfirmasi, mengubah status ke Dicabut, dan menghapus tombolnya", async ({ page }) => {
    await page.goto("/invitations");
    const b = baris(page, EMAIL);
    // Membatalkan konfirmasi tidak mengubah apa pun.
    page.once("dialog", (dialog) => dialog.dismiss());
    await b.getByRole("button", { name: "Cabut" }).click();
    await expect(baris(page, EMAIL).getByText("Menunggu", { exact: true })).toBeVisible();
    // Menyetujui konfirmasi mencabutnya.
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain(EMAIL);
      return dialog.accept();
    });
    await baris(page, EMAIL).getByRole("button", { name: "Cabut" }).click();
    const sesudah = baris(page, EMAIL);
    await expect(sesudah.getByText("Dicabut", { exact: true })).toBeVisible();
    await expect(sesudah.getByRole("button", { name: "Kirim Ulang" })).toHaveCount(0);
    await expect(sesudah.getByRole("button", { name: "Cabut" })).toHaveCount(0);
  });

  test("[TC-AD-21] setelah undangan dicabut, email yang sama bisa diundang lagi", async ({ page }) => {
    await page.goto("/invitations");
    await kirimUndangan(page, NAMA, EMAIL, KELAS);
    await expect(page.getByText(/Gagal mengirim undangan/)).toHaveCount(0);
    await expect(page.locator("tr", { hasText: EMAIL }).getByText("Menunggu", { exact: true })).toHaveCount(1);
  });

  test.afterAll(async ({ browser }) => {
    // Bersih-bersih: cabut undangan yang masih menunggu lalu arsipkan kelas uji.
    const context = await browser.newContext({ baseURL: cfg.adminUrl });
    const page = await context.newPage();
    try {
      await page.goto("/invitations");
      const menunggu = page.locator("tr", { hasText: EMAIL }).filter({ has: page.getByText("Menunggu", { exact: true }) });
      if (await menunggu.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        page.once("dialog", (dialog) => dialog.accept());
        await menunggu.first().getByRole("button", { name: "Cabut" }).click();
        await page.waitForTimeout(600);
      }
      await page.goto("/classes");
      const arsipkan = page.locator("tr", { hasText: KELAS }).getByRole("button", { name: "Arsipkan" });
      if (await arsipkan.isVisible({ timeout: 5000 }).catch(() => false)) await arsipkan.click();
    } finally {
      await context.close();
    }
  });
});
