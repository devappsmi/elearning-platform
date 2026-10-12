import { expect, test, type Page } from "@playwright/test";
import { expectNoLeakedDebugText } from "../support/auth";
import { cfg } from "../support/env";

/**
 * Admin: daftar murid dan detail murid. Uji yang mengubah akun memakai murid uji KEDUA (QA_STUDENT2_*), bukan murid uji
 * utama, dan selalu mengembalikan keadaannya (aktif, kelas semula). Kode [TC-..] = kasus di buku kasus uji.
 */

const SALAH = "Email atau password salah.";

/** Membuka detail murid dari daftar (mencari lewat email) dan menunggu halamannya selesai dimuat. */
async function bukaDetail(page: Page, email: string): Promise<void> {
  await page.goto("/students");
  const baris = page.locator("tr", { hasText: email });
  await expect(baris).toBeVisible();
  await baris.getByRole("link", { name: "Lihat detail" }).click();
  await expect(page).toHaveURL(/\/students\/[^/]+$/);
  await expect(page.getByText("Progres per Unit")).toBeVisible();
}

async function masukSebagaiMurid(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${cfg.studentUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test.describe("Daftar dan detail murid", () => {
  test("[TC-AD-22] daftar murid menampilkan nama, email, kelas, status, XP, dan streak, dan bisa disaring per kelas", { tag: "@smoke" }, async ({ page }) => {
    test.skip(!cfg.student.email, "QA_STUDENT_EMAIL belum diisi");
    await page.goto("/students");
    const baris = page.locator("tr", { hasText: cfg.student.email });
    await expect(baris).toBeVisible();
    // Judul kolom dibaca dari <th> (di Chromium <th> tanpa scope dibaca sebagai sel biasa, jadi bukan lewat peran columnheader).
    await expect(page.locator("thead th")).toContainText(["Nama", "Email", "Kelas", "Status", "XP", "Streak", ""]);
    await expect(baris.locator("td").nth(3)).toHaveText(/^(Aktif|Nonaktif)$/);
    await expect(baris.locator("td").nth(4)).toHaveText(/^\d+$/);
    await expect(baris.locator("td").nth(5)).toHaveText(/^\d+$/);

    const kelasMurid = (await baris.locator("td").nth(2).innerText()).trim();
    await page.locator("#filter-class").selectOption({ label: kelasMurid });
    await expect(page.locator("tr", { hasText: cfg.student.email })).toBeVisible();
    for (const kelas of await page.locator("tbody tr td:nth-child(3)").allInnerTexts()) expect(kelas.trim()).toBe(kelasMurid);
    await page.locator("#filter-class").selectOption("");
    await expectNoLeakedDebugText(page);
  });

  test("[TC-AD-23] detail murid menampilkan profil, empat angka ringkasan, dan tiga tabel kemajuan", async ({ page }) => {
    test.skip(!cfg.student.email, "QA_STUDENT_EMAIL belum diisi");
    await bukaDetail(page, cfg.student.email);
    await expect(page.getByText(cfg.student.email, { exact: true })).toBeVisible();
    await expect(page.getByText(/^Kelas: .+ · Bergabung \d/)).toBeVisible();
    for (const label of ["Level", "Total XP", "Streak Saat Ini", "Streak Terpanjang"]) {
      const kartu = page.getByText(label, { exact: true });
      await expect(kartu).toBeVisible();
      expect((await kartu.locator("xpath=following-sibling::p").innerText()).trim()).toMatch(/^\d+$/);
    }
    for (const judul of ["Progres per Unit", "Skor Percakapan", "Aktivitas Terbaru"]) await expect(page.getByRole("heading", { name: judul })).toBeVisible();
    await page.getByRole("link", { name: /Kembali ke daftar murid/ }).click();
    await expect(page).toHaveURL(/\/students$/);
  });

  test("[TC-AD-24] membuka detail murid yang tidak ada menampilkan pesan, bukan layar kosong", async ({ page }) => {
    await page.goto("/students/tidak-ada-id-ini");
    await expect(page.getByText("Gagal memuat data murid.")).toBeVisible();
  });
});

test.describe.serial("Mengubah akun murid (memakai murid uji kedua)", () => {
  test.skip(!cfg.student2.email, "QA_STUDENT2_EMAIL belum diisi (murid uji kedua untuk uji yang mengubah akun)");

  test("[TC-AD-25] memindahkan murid ke kelas lain mengubah kelasnya, lalu dikembalikan", async ({ page }) => {
    const kelasSementara = `${cfg.prefix} Kelas Pindah ${Date.now()}`;
    await page.goto("/classes");
    await page.getByLabel("Nama Kelas").fill(kelasSementara);
    await page.getByRole("button", { name: "Buat Kelas" }).click();
    await expect(page.locator("tr", { hasText: kelasSementara })).toBeVisible();

    await bukaDetail(page, cfg.student2.email);
    const asal = (await page.locator("#move-class option:checked").innerText()).trim();
    try {
      await page.locator("#move-class").selectOption({ label: kelasSementara });
      await page.getByRole("button", { name: "Pindahkan" }).click();
      await expect(page.getByText(new RegExp(`^Kelas: ${kelasSementara}`))).toBeVisible();
      // Tombol Pindahkan mati lagi karena kelas tujuan = kelas sekarang.
      await expect(page.getByRole("button", { name: "Pindahkan" })).toBeDisabled();
    } finally {
      await page.locator("#move-class").selectOption({ label: asal });
      await page.getByRole("button", { name: "Pindahkan" }).click();
      await expect(page.getByText(new RegExp(`^Kelas: ${asal}`))).toBeVisible();
      await page.goto("/classes");
      await page.locator("tr", { hasText: kelasSementara }).getByRole("button", { name: "Arsipkan" }).click();
    }
  });

  test("[TC-AD-26] menonaktifkan murid: akun tidak bisa masuk lagi, dan mengaktifkannya mengembalikan akses", async ({ page, browser }) => {
    await bukaDetail(page, cfg.student2.email);
    try {
      await page.getByRole("button", { name: "Nonaktifkan Murid" }).click();
      await expect(page.getByText("Nonaktif", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Aktifkan Murid" })).toBeVisible();

      const sesiMurid = await browser.newContext({ baseURL: cfg.studentUrl, storageState: { cookies: [], origins: [] } });
      const halamanMurid = await sesiMurid.newPage();
      try {
        await masukSebagaiMurid(halamanMurid, cfg.student2.email, cfg.student2.password);
        await expect(halamanMurid.getByRole("alert")).toHaveText(SALAH);
        await expect(halamanMurid).toHaveURL(/\/login/);
      } finally {
        await sesiMurid.close();
      }
    } finally {
      const aktifkan = page.getByRole("button", { name: "Aktifkan Murid" });
      if (await aktifkan.isVisible()) await aktifkan.click();
      await expect(page.getByRole("button", { name: "Nonaktifkan Murid" })).toBeVisible();
    }

    const sesiBaru = await browser.newContext({ baseURL: cfg.studentUrl, storageState: { cookies: [], origins: [] } });
    const halamanBaru = await sesiBaru.newPage();
    try {
      await masukSebagaiMurid(halamanBaru, cfg.student2.email, cfg.student2.password);
      await expect(halamanBaru).not.toHaveURL(/\/login/);
      await expect(halamanBaru.getByRole("button", { name: "Keluar" }).first()).toBeVisible();
    } finally {
      await sesiBaru.close();
    }
  });

  test("[TC-AD-27] murid yang sedang masuk lalu dinonaktifkan kehilangan akses begitu halaman dimuat ulang", async ({ page, browser }) => {
    // TEMUAN DIKETAHUI: saat ini sesi murid yang sudah berjalan tetap berlaku sampai token pembaruannya habis (14 hari);
    // hanya login baru yang diblokir. PRD ADM-21 menulis "murid tidak bisa login". Uji ini menuliskan harapan yang
    // lebih ketat (sesi ikut berhenti) dan DITANDAI diharapkan gagal sampai pemilik produk memutuskan. Bila uji ini
    // tiba-tiba lulus, perilakunya sudah berubah: hapus baris test.fail di bawah.
    test.fail(true, "Temuan diketahui: sesi murid yang sudah berjalan tidak ikut berhenti saat akun dinonaktifkan.");
    const sesiMurid = await browser.newContext({ baseURL: cfg.studentUrl, storageState: { cookies: [], origins: [] } });
    const halamanMurid = await sesiMurid.newPage();
    try {
      await masukSebagaiMurid(halamanMurid, cfg.student2.email, cfg.student2.password);
      await expect(halamanMurid.getByRole("button", { name: "Keluar" }).first()).toBeVisible();

      await bukaDetail(page, cfg.student2.email);
      await page.getByRole("button", { name: "Nonaktifkan Murid" }).click();
      await expect(page.getByText("Nonaktif", { exact: true })).toBeVisible();

      await halamanMurid.reload();
      await expect(halamanMurid).toHaveURL(/\/login/, { timeout: 8000 });
    } finally {
      const aktifkan = page.getByRole("button", { name: "Aktifkan Murid" });
      if (await aktifkan.isVisible().catch(() => false)) await aktifkan.click();
      await sesiMurid.close();
    }
  });

  test("[TC-AD-28] tombol Kirim Email Reset Password memberi pesan berhasil (atau pesan batas per jam)", async ({ page }) => {
    await bukaDetail(page, cfg.student2.email);
    await page.getByRole("button", { name: "Kirim Email Reset Password" }).click();
    const berhasil = page.getByText("Email reset password sudah dikirim ke murid.");
    const dibatasi = page.getByText(/batas|terlalu sering|3 kali/i);
    await expect(berhasil.or(dibatasi)).toBeVisible();
    await expect(page.getByText("Gagal mengirim email reset password.")).toHaveCount(0);
  });
});
