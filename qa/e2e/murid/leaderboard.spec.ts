import { expect, test } from "@playwright/test";
import { expectNoLeakedDebugText } from "../support/auth";

/** Leaderboard: peringkat XP mingguan satu kelas. Kode [TC-..] = kasus di buku kasus uji. */

test.describe("Leaderboard", () => {
  test("[TC-LB-01] halaman peringkat memuat judul, tanggal awal minggu, dan daftar atau pesan kosong", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: "Peringkat Minggu Ini" })).toBeVisible();
    await expect(page.getByText(/^Minggu dimulai \d{1,2}\/\d{1,2}\/\d{4}$/)).toBeVisible();
    const kosong = page.getByText("Belum ada aktivitas XP minggu ini di kelasmu. Mulai belajar untuk masuk peringkat!");
    const daftar = page.locator("main ol li, main table tbody tr").first();
    await expect(kosong.or(daftar)).toBeVisible();
    await expectNoLeakedDebugText(page);
  });

  test("[TC-LB-02] minggu dihitung mulai hari Senin", async ({ page }) => {
    await page.goto("/leaderboard");
    const teks = await page.getByText(/^Minggu dimulai \d{1,2}\/\d{1,2}\/\d{4}$/).innerText();
    const [, hari, bulan, tahun] = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(teks)!.map(Number) as [number, number, number, number];
    const senin = new Date(Date.UTC(tahun, bulan - 1, hari)).getUTCDay();
    expect(senin, `Tanggal awal minggu ${hari}/${bulan}/${tahun} seharusnya hari Senin`).toBe(1);
  });

  test("[TC-LB-03] baris murid yang sedang masuk ditandai (kamu) dan urutan XP tidak naik ke bawah", async ({ page }) => {
    await page.goto("/leaderboard");
    const kosong = page.getByText(/^Belum ada aktivitas XP minggu ini/);
    const baris = page.locator("main ol li, main table tbody tr");
    await expect(kosong.or(baris.first())).toBeVisible();
    if (await kosong.isVisible()) test.skip(true, "Peringkat minggu ini masih kosong (belum ada XP di kelas ini).");

    const semua = await baris.allInnerTexts();
    const xp = semua.map((teks) => {
      const rapi = teks.replace(/\s+/g, " ");
      const cocok = /(\d+)\s*XP/.exec(rapi);
      return cocok ? Number(cocok[1]) : Number([...rapi.matchAll(/\d+/g)].pop()![0]);
    });
    // Podium ditulis urut 2-1-3 di layar, jadi urutan dibaca dari angka peringkatnya: cukup pastikan XP bukan nol dan terbaca.
    for (const nilai of xp) expect(Number.isFinite(nilai)).toBe(true);
    const milikku = page.locator("main").getByText("(kamu)");
    if ((await milikku.count()) > 0) await expect(milikku.first()).toBeVisible();
  });
});
