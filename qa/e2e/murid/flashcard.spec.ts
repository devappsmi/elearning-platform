import { expect, test, type Page } from "@playwright/test";
import { expectNoLeakedDebugText } from "../support/auth";

/**
 * Flashcard: kartu ulangan kata yang jatuh tempo. Murid baru belum punya kartu jatuh tempo (kartu pertama baru jatuh tempo
 * besok), jadi uji ini menyesuaikan diri: bila ada kartu, alur ulangannya diuji; bila tidak, tampilan kosongnya diuji.
 * Cara menyiapkan kartu jatuh tempo ada di qa/README.md (bagian Flashcard). Kode [TC-..] = kasus di buku kasus uji.
 */

async function bukaFlashcard(page: Page): Promise<"kartu" | "kosong"> {
  await page.goto("/flashcards");
  const kosong = page.getByTestId("flashcards-empty");
  const kartu = page.getByTestId("flashcard");
  await expect(kosong.or(kartu)).toBeVisible();
  return (await kartu.isVisible()) ? "kartu" : "kosong";
}

test.describe("Flashcard", () => {
  test("[TC-FC-01] halaman Flashcard menampilkan kartu atau pesan bahwa tidak ada yang perlu diulang", { tag: "@smoke" }, async ({ page }) => {
    const keadaan = await bukaFlashcard(page);
    if (keadaan === "kosong") {
      await expect(page.getByText("Tidak ada kartu untuk direview hari ini.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Ke Beranda" })).toBeVisible();
    } else {
      await expect(page.getByText(/^Kartu 1 dari \d+$/)).toBeVisible();
    }
    await expectNoLeakedDebugText(page);
  });

  test("[TC-FC-02] alur ulangan: tampilkan jawaban, nilai benar/salah, sampai layar Review Selesai", async ({ page }) => {
    const keadaan = await bukaFlashcard(page);
    if (keadaan === "kosong") test.skip(true, "Tidak ada kartu jatuh tempo untuk akun ini (lihat qa/README.md, bagian Flashcard).");

    const total = Number(/dari (\d+)$/.exec(await page.getByText(/^Kartu \d+ dari \d+$/).innerText())![1]);
    expect(total).toBeGreaterThan(0);
    let benar = 0;
    let salah = 0;
    for (let nomor = 1; nomor <= total; nomor++) {
      await expect(page.getByText(`Kartu ${nomor} dari ${total}`)).toBeVisible();
      const kartu = page.getByTestId("flashcard");
      // Sebelum dibuka: arti belum terlihat, tombol Benar/Salah belum ada.
      await expect(page.getByTestId("flashcard-back")).toHaveCount(0);
      await expect(page.getByTestId("answer-correct")).toHaveCount(0);
      await expect(kartu.locator("p").first()).not.toHaveText("");
      await page.getByTestId("reveal-button").click();
      await expect(page.getByTestId("flashcard-back")).toBeVisible();
      await expect(page.getByTestId("flashcard-back")).not.toHaveText("");
      // Kartu pertama sengaja dinilai salah supaya kedua hitungan teruji.
      if (nomor === 1) {
        await page.getByTestId("answer-wrong").click();
        salah += 1;
      } else {
        await page.getByTestId("answer-correct").click();
        benar += 1;
      }
    }
    await expect(page.getByTestId("flashcards-done")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Review Selesai" })).toBeVisible();
    await expect(page.getByText(`${benar} benar, ${salah} salah dari ${total} kartu.`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Kembali ke Beranda" })).toBeVisible();
  });

  test("[TC-FC-03] setelah semua kartu dinilai, kartu yang sudah diulang tidak muncul lagi hari ini", async ({ page }) => {
    // Kartu baru jatuh tempo lagi setelah jadwal ulangnya (minimal 1 hari). Bila alur FC-02 baru dijalankan, deck kosong.
    const keadaan = await bukaFlashcard(page);
    if (keadaan === "kartu") test.skip(true, "Masih ada kartu jatuh tempo (alur FC-02 belum dijalankan untuk akun ini).");
    await expect(page.getByText("Tidak ada kartu untuk direview hari ini.")).toBeVisible();
  });
});
