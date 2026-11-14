import { expect, test, type Page } from "@playwright/test";
import { cfg } from "../support/env";
import { expectNoLeakedDebugText } from "../support/auth";
import { playLesson } from "../support/lesson";

/** Pelajaran terakhir jalur Hiragana: baru terbuka setelah pelajaran sebelumnya lulus, jadi terkunci untuk murid uji. */
const TERKUNCI = { id: "l7", judul: "Youon 2, sokuon, dan vokal panjang" };

/** Beranda murid: sapaan, statistik, jalur belajar, dan kunci pelajaran. Kode [TC-..] = kasus di buku kasus uji. */

/** Membuka Beranda dan menunggu jalur belajarnya selesai dimuat (supaya pemeriksaan tidak mendahului data). */
async function bukaBeranda(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^Selamat datang, / })).toBeVisible();
  await expect(page.locator("ol > li").first()).toBeVisible();
}

test.describe("Beranda", () => {
  test("[TC-BR-01] beranda menyapa murid dan menampilkan statistik belajar", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /^Selamat datang, / })).toBeVisible();
    await expect(page.getByText(/^Streak\s*\d+\s*hari$/)).toBeVisible();
    await expect(page.getByText(/^Terpanjang\s*\d+\s*hari$/)).toBeVisible();
    await expect(page.getByText(/^Pelajaran selesai\s*\d+\/\d+$/)).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Kemajuan belajar" })).toBeVisible();
    await expectNoLeakedDebugText(page);
  });

  test("[TC-BR-02] jalur belajar memuat unit dan pelajaran dengan keterangan status yang terbaca", async ({ page }) => {
    await bukaBeranda(page);
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
    // Tiap pelajaran punya penjelasan status untuk pembaca layar: tersedia / selesai / terkunci.
    const lessons = page.locator("ol > li");
    expect(await lessons.count()).toBeGreaterThan(3);
    const status = page.locator("ol > li span.sr-only");
    const texts = await status.allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text).toMatch(/terkunci|tersedia|selesai/);
  });

  test("[TC-BR-03] tombol Lanjutkan Belajar membuka pelajaran berikutnya yang tersedia", async ({ page }) => {
    await bukaBeranda(page);
    const lanjut = page.getByRole("link", { name: /Lanjutkan Belajar/ });
    if ((await lanjut.count()) === 0) {
      test.skip(true, "Semua pelajaran sudah selesai, tidak ada pelajaran berikutnya.");
    }
    await lanjut.click();
    await expect(page).toHaveURL(/\/learn\/[^/]+$/);
    await expect(page.getByRole("link", { name: "Tutup pelajaran" })).toBeVisible();
  });

  test("[TC-BR-04] pelajaran yang masih terkunci tidak bisa diklik dan tidak punya tautan", async ({ page }) => {
    await bukaBeranda(page);
    const terkunci = page.locator('[aria-disabled="true"]', { hasText: "terkunci" });
    if ((await terkunci.count()) === 0) test.skip(true, "Tidak ada pelajaran terkunci di akun ini (semua sudah terbuka).");
    const pertama = terkunci.first();
    await expect(pertama).toHaveAttribute("title", "Terkunci");
    expect(await pertama.evaluate((el) => el.tagName.toLowerCase()), "Pelajaran terkunci tidak boleh berupa tautan").not.toBe("a");
    await pertama.click({ force: true });
    await expect(page).toHaveURL(/\/$/);
  });

  test("[TC-BR-05] pelajaran terkunci yang dibuka lewat alamat langsung: hasilnya ditolak server dan kemajuan tidak berubah", async ({ page }) => {
    await bukaBeranda(page);
    const terkunci = page.locator('[aria-disabled="true"]', { hasText: TERKUNCI.judul });
    if ((await terkunci.count()) === 0) test.skip(true, `Pelajaran "${TERKUNCI.judul}" sudah terbuka di akun ini.`);
    const selesaiSebelum = (await page.getByText(/^Pelajaran selesai\s*\d+\/\d+$/).innerText()).replace(/\s+/g, " ");

    await page.goto(`/learn/${TERKUNCI.id}`);
    const hasil = await playLesson(page, new Map(), "tebak");
    expect(hasil.outcome, "Server seharusnya menolak hasil pelajaran yang masih terkunci").toBe("ditolak");
    await expect(page.getByText("Gagal mengirim hasil belajar.")).toBeVisible();

    await page.getByRole("button", { name: "Kembali ke Beranda" }).click();
    await expect(page).toHaveURL(/\/$/);
    const selesaiSesudah = (await page.getByText(/^Pelajaran selesai\s*\d+\/\d+$/).innerText()).replace(/\s+/g, " ");
    expect(selesaiSesudah, "Jumlah pelajaran selesai tidak boleh berubah").toBe(selesaiSebelum);
    await expect(page.locator('[aria-disabled="true"]', { hasText: TERKUNCI.judul })).toHaveCount(1);
  });

  test("[TC-BR-06] alamat pelajaran yang tidak ada menampilkan pesan, bukan layar kosong", async ({ page }) => {
    await page.goto(`/learn/tidak-ada-${Date.now()}`);
    await expect(page.getByText("Gagal memuat pelajaran.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kembali ke Beranda" })).toBeVisible();
  });

  test("[TC-BR-07] menu utama membawa murid ke semua halaman belajar", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("navigation", { name: "Menu utama" }).first();
    const tujuan: Array<[string, RegExp, string]> = [
      ["Percakapan", /\/conversation$/, "Percakapan"],
      ["Kamus", /\/dictionary$/, "Kamus"],
      ["Flashcard", /\/flashcards$/, "Flashcard"],
      ["Leaderboard", /\/leaderboard$/, "Peringkat Minggu Ini"],
      ["Profil", /\/profile$/, "Profil"],
      ["Beranda", /\/$/, ""],
    ];
    for (const [nama, url, judul] of tujuan) {
      await menu.getByRole("link", { name: nama, exact: true }).click();
      await expect(page, `Menu ${nama} seharusnya membuka ${url}`).toHaveURL(url);
      if (judul) await expect(page.getByRole("heading", { name: judul, exact: true }).first()).toBeVisible();
    }
  });

  test("[TC-BR-08] unit di level lanjutan (N4) tampil terkunci untuk murid baru", async ({ page }) => {
    test.skip(!cfg.student.email, "QA_STUDENT_EMAIL belum diisi");
    await bukaBeranda(page);
    const unit = page.getByRole("heading", { level: 3, name: "Percakapan di Tempat Kerja" });
    if ((await unit.count()) === 0) test.skip(true, "Unit N4 tidak ada di data ini.");
    // Spanduk unit terkunci memakai ikon gembok di samping hitungan "0/11".
    const spanduk = unit.locator("xpath=ancestor::div[contains(@class,'bg-gradient-to-r')][1]");
    await expect(spanduk.locator("svg").first()).toBeVisible();
    await expect(spanduk).toContainText(/\d+\/\d+/);
  });
});
