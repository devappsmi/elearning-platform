import { expect, test } from "@playwright/test";
import { expectNoLeakedDebugText } from "../support/auth";

/** Kamus: pencarian kana, romaji, kanji, dan arti Indonesia. Kode [TC-..] = kasus di buku kasus uji. */

const KOTAK_CARI = "#dictionary-search";

test.describe("Kamus", () => {
  test("[TC-KM-01] halaman Kamus kosong sampai murid mengetik", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/dictionary");
    await expect(page.getByRole("heading", { name: "Kamus", exact: true })).toBeVisible();
    await expect(page.locator(KOTAK_CARI)).toBeFocused();
    await expect(page.getByText("Ketik untuk mulai mencari.")).toBeVisible();
    await expectNoLeakedDebugText(page);
  });

  test("[TC-KM-02] mencari dengan romaji menampilkan kata, bacaan, dan arti Indonesianya", async ({ page }) => {
    await page.goto("/dictionary");
    await page.locator(KOTAK_CARI).fill("oishii");
    const kartu = page.locator("main div.grid > div").filter({ hasText: "おいしい" });
    await expect(kartu).toHaveCount(1);
    await expect(kartu).toContainText("oishii");
    await expect(kartu).toContainText("Enak");
    await expect(page.getByText("Ketik untuk mulai mencari.")).toHaveCount(0);
  });

  test("[TC-KM-03] mencari dengan huruf kana atau kanji", async ({ page }) => {
    await page.goto("/dictionary");
    await page.locator(KOTAK_CARI).fill("お名前");
    await expect(page.getByText("おなまえ")).toBeVisible();
    await expect(page.getByText("nama (bentuk sopan)")).toBeVisible();

    await page.locator(KOTAK_CARI).fill("おいしい");
    await expect(page.getByText("Enak", { exact: true })).toBeVisible();
  });

  test("[TC-KM-04] mencari dengan arti Indonesia tidak peduli huruf besar-kecil", async ({ page }) => {
    await page.goto("/dictionary");
    for (const kata of ["enak", "ENAK", "Enak"]) {
      await page.locator(KOTAK_CARI).fill(kata);
      await expect(page.getByText("Enak", { exact: true }), `Pencarian "${kata}" seharusnya menemukan "Enak"`).toBeVisible();
    }
  });

  test("[TC-KM-05] kata yang tidak ada menampilkan pesan Tidak ada hasil", async ({ page }) => {
    await page.goto("/dictionary");
    await page.locator(KOTAK_CARI).fill("zzzzbukankata");
    await expect(page.getByText('Tidak ada hasil untuk "zzzzbukankata".')).toBeVisible();
  });

  test("[TC-KM-06] mengosongkan kotak cari mengembalikan tampilan awal", async ({ page }) => {
    await page.goto("/dictionary");
    await page.locator(KOTAK_CARI).fill("oishii");
    await expect(page.getByText("Enak", { exact: true })).toBeVisible();
    await page.locator(KOTAK_CARI).fill("");
    await expect(page.getByText("Ketik untuk mulai mencari.")).toBeVisible();
    await page.locator(KOTAK_CARI).fill("   ");
    await expect(page.getByText("Ketik untuk mulai mencari.")).toBeVisible();
  });

  test("[TC-KM-07] spasi di awal/akhir diabaikan dan tanda kutip, tag HTML, serta teks panjang aman", async ({ page }) => {
    const dialog: string[] = [];
    page.on("dialog", async (d) => {
      dialog.push(d.message());
      await d.dismiss();
    });
    await page.goto("/dictionary");
    await page.locator(KOTAK_CARI).fill("  oishii  ");
    await expect(page.getByText("Enak", { exact: true })).toBeVisible();

    const aneh = `<img src=x onerror=alert(1)> "'\`;--`;
    await page.locator(KOTAK_CARI).fill(aneh);
    await expect(page.getByText(/^Tidak ada hasil untuk/)).toBeVisible();
    // Teks dicetak apa adanya (bukan dijalankan sebagai HTML).
    await expect(page.locator("main img")).toHaveCount(0);

    await page.locator(KOTAK_CARI).fill("a".repeat(600));
    await expect(page.getByText(/^Tidak ada hasil untuk|Gagal mencari kamus\./).first()).toBeVisible();
    await page.locator(KOTAK_CARI).fill("oishii");
    await expect(page.getByText("Enak", { exact: true })).toBeVisible();
    expect(dialog, "Tidak boleh ada skrip yang berjalan dari isi pencarian").toEqual([]);
  });

  test("[TC-KM-08] hasil pencarian umum (satu huruf) tampil rapi tanpa teks mentah atau tumpang tindih", async ({ page }) => {
    await page.goto("/dictionary");
    await page.locator(KOTAK_CARI).fill("a");
    const kartu = page.locator("main div.grid > div");
    await expect(kartu.first()).toBeVisible();
    expect(await kartu.count()).toBeGreaterThan(5);
    await expectNoLeakedDebugText(page);
    // Tidak ada gulir mendatar yang tidak diinginkan.
    const lebih = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(lebih, "Halaman tidak boleh bergulir ke samping").toBeLessThanOrEqual(1);
  });
});
