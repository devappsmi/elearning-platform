import { expect, test, type Page } from "@playwright/test";
import { expectNoLeakedDebugText } from "../support/auth";
import { cfg } from "../support/env";

/**
 * Profil: info akun, ubah nama, dan ubah target XP harian. Uji yang mengubah data selalu mengembalikan nilai awalnya.
 * Kode [TC-..] = kasus di buku kasus uji.
 */

const NAMA = "#profile-name";
const TARGET = "#profile-xp-goal";

async function bukaProfil(page: Page): Promise<{ nama: string; target: string }> {
  await page.goto("/profile");
  await expect(page.locator(NAMA)).toBeVisible();
  return { nama: await page.locator(NAMA).inputValue(), target: await page.locator(TARGET).inputValue() };
}

async function simpan(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Simpan Perubahan" }).click();
  await expect(page.getByText("Perubahan tersimpan.")).toBeVisible();
}

test.describe("Profil", () => {
  test("[TC-PF-01] profil menampilkan nama, email, kelas, tanggal bergabung, dan target XP", { tag: "@smoke" }, async ({ page }) => {
    const awal = await bukaProfil(page);
    await expect(page.getByRole("heading", { name: "Profil", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Info Akun" })).toBeVisible();
    if (cfg.student.email) await expect(page.getByText(cfg.student.email, { exact: true })).toBeVisible();
    await expect(page.getByTestId("profile-class")).not.toHaveText("");
    await expect(page.getByText(/^\d{1,2}\/\d{1,2}\/\d{4}$/).first()).toBeVisible();
    expect(awal.nama.length).toBeGreaterThan(0);
    expect(["10", "30", "50"]).toContain(awal.target);
    // Pilihan target hanya 10, 30, atau 50 XP per hari.
    const pilihan = await page.locator(`${TARGET} option`).allInnerTexts();
    expect(pilihan.map((teks) => teks.trim())).toEqual(["10 XP/hari", "30 XP/hari", "50 XP/hari"]);
    await expectNoLeakedDebugText(page);
  });

  test("[TC-PF-02] email tidak bisa diubah dari layar profil", async ({ page }) => {
    await bukaProfil(page);
    await expect(page.locator('main input[type="email"]')).toHaveCount(0);
    await expect(page.getByLabel("Email")).toHaveCount(0);
  });

  test("[TC-PF-03] mengubah nama tersimpan, ikut berubah di menu, bertahan setelah muat ulang, lalu dikembalikan", async ({ page }) => {
    const awal = await bukaProfil(page);
    const baru = `${awal.nama} Ubah`;
    try {
      await page.locator(NAMA).fill(baru);
      await simpan(page);
      await expect(page.getByText(baru, { exact: true }).first()).toBeVisible();
      await page.reload();
      await expect(page.locator(NAMA)).toHaveValue(baru);
    } finally {
      await page.goto("/profile");
      await page.locator(NAMA).fill(awal.nama);
      await simpan(page);
    }
    await page.reload();
    await expect(page.locator(NAMA)).toHaveValue(awal.nama);
  });

  test("[TC-PF-04] mengubah target XP harian tersimpan dan bertahan setelah muat ulang, lalu dikembalikan", async ({ page }) => {
    const awal = await bukaProfil(page);
    const baru = awal.target === "50" ? "10" : "50";
    try {
      await page.locator(TARGET).selectOption(baru);
      await simpan(page);
      await expect(page.getByText(`${baru} XP/hari`, { exact: true }).first()).toBeVisible();
      await page.reload();
      await expect(page.locator(TARGET)).toHaveValue(baru);
    } finally {
      await page.goto("/profile");
      await page.locator(TARGET).selectOption(awal.target);
      await simpan(page);
    }
    await page.reload();
    await expect(page.locator(TARGET)).toHaveValue(awal.target);
  });

  test("[TC-PF-05] nama yang hanya berisi spasi ditolak dengan pesan yang jelas", async ({ page }) => {
    const awal = await bukaProfil(page);
    let patchTerkirim = false;
    page.on("request", (request) => {
      if (request.method() === "PATCH" && request.url().includes("/me")) patchTerkirim = true;
    });
    await page.locator(NAMA).fill("     ");
    await page.getByRole("button", { name: "Simpan Perubahan" }).click();
    await expect(page.getByRole("alert")).toHaveText("Nama tidak boleh kosong.");
    expect(patchTerkirim, "Nama kosong seharusnya ditahan sebelum dikirim ke server").toBe(false);
    await page.reload();
    await expect(page.locator(NAMA)).toHaveValue(awal.nama);
  });

  test("[TC-PF-06] nama berisi tanda baca, huruf Jepang, dan tag HTML tampil apa adanya (tidak dijalankan)", async ({ page }) => {
    const awal = await bukaProfil(page);
    const dialog: string[] = [];
    page.on("dialog", async (d) => {
      dialog.push(d.message());
      await d.dismiss();
    });
    const aneh = `Ani 田中 <img src=x onerror=alert(1)> & "O'Brien"`;
    try {
      await page.locator(NAMA).fill(aneh);
      await simpan(page);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /^Selamat datang, / })).toContainText("田中");
      await expect(page.locator("main img")).toHaveCount(0);
      expect(dialog, "Tidak boleh ada skrip yang berjalan dari nama murid").toEqual([]);
    } finally {
      await page.goto("/profile");
      await page.locator(NAMA).fill(awal.nama);
      await simpan(page);
    }
  });

  test("[TC-PF-07] nama yang sangat panjang (300 karakter) tidak merusak tata letak, lalu dikembalikan", async ({ page }) => {
    const awal = await bukaProfil(page);
    const panjang = "Bu".repeat(150);
    try {
      await page.locator(NAMA).fill(panjang);
      await page.getByRole("button", { name: "Simpan Perubahan" }).click();
      const diterima = page.getByText("Perubahan tersimpan.");
      const ditolak = page.getByRole("alert");
      await expect(diterima.or(ditolak)).toBeVisible();
      if (await diterima.isVisible()) {
        // Server menerimanya: tampilan tetap tidak boleh bergulir ke samping di Beranda, Profil, dan Leaderboard.
        for (const alamat of ["/profile", "/", "/leaderboard"]) {
          await page.goto(alamat);
          await expect(page.getByRole("button", { name: "Keluar" }).first()).toBeVisible();
          const lebih = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(lebih, `Halaman ${alamat} bergulir ke samping karena nama panjang`).toBeLessThanOrEqual(1);
        }
      }
    } finally {
      await page.goto("/profile");
      await page.locator(NAMA).fill(awal.nama);
      await simpan(page);
    }
  });
});
