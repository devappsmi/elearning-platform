import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { expectNoLeakedDebugText } from "../support/auth";
import { playScenario, readScenarioResult, startScenario, type ChoiceBook } from "../support/scenario";
import { weeklyXp } from "../support/xp";

/**
 * Percakapan: katalog skenario, mode Latihan dan Tes, koreksi jawaban, hasil dan XP.
 * Skenario yang dimainkan: "perkenalan" (自己紹介 / Perkenalan Diri). Kode [TC-..] = kasus di buku kasus uji.
 */

const SKENARIO = "perkenalan";
const ALAMAT = `/conversation/${SKENARIO}`;

test.describe("Katalog dan layar pengantar", () => {
  test("[TC-PC-01] halaman Percakapan menampilkan kartu Ngobrol dengan AI dan daftar skenario latihan", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/conversation");
    await expect(page.getByRole("heading", { name: "Percakapan", exact: true })).toBeVisible();
    await expect(page.getByTestId("open-ai-chat")).toContainText("Ngobrol dengan AI");
    await expect(page.getByRole("heading", { name: "Skenario latihan" })).toBeVisible();
    const kartu = page.locator(`a[href="${ALAMAT}"]`);
    await expect(kartu).toBeVisible();
    await expect(kartu).toContainText("自己紹介");
    await expect(kartu).toContainText("Perkenalan Diri");
    await expect(kartu).toContainText(/N\d/);
    await expect(kartu).toContainText(/~\d+ menit/);
    await expectNoLeakedDebugText(page);
  });

  test("[TC-PC-02] layar pengantar menjelaskan dua mode: Latihan tanpa batas dan Tes dengan batas 3 kali salah", async ({ page }) => {
    await page.goto(ALAMAT);
    await expect(page.getByRole("heading", { level: 1, name: "自己紹介" })).toBeVisible();
    await expect(page.getByText("Perkenalan Diri", { exact: true })).toBeVisible();
    await expect(page.getByTestId("start-practice")).toHaveText("Latihan");
    await expect(page.getByTestId("start-test")).toHaveText("Mulai Tes");
    await expect(page.getByText(/boleh mengulang tanpa batas/)).toBeVisible();
    await expect(page.getByText(/hanya 3 kali salah/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Catatan Tata Bahasa" })).toBeVisible();
  });

  test("[TC-PC-09] alamat skenario yang tidak dikenal menampilkan pesan dan jalan kembali", async ({ page }) => {
    await page.goto(`/conversation/tidak-ada-${Date.now()}`);
    await expect(page.getByText("Gagal memuat skenario.")).toBeVisible();
    await page.getByRole("button", { name: "Kembali ke Percakapan" }).click();
    await expect(page).toHaveURL(/\/conversation$/);
  });

  test("[TC-PC-10] membuka alamat layar hasil secara langsung mengarahkan ke daftar Percakapan", async ({ page }) => {
    await page.goto(`${ALAMAT}/result`);
    await expect(page).toHaveURL(/\/conversation$/);
  });

  test("[TC-PC-11] tombol Tutup (X) di tengah percakapan kembali ke daftar tanpa menyimpan", async ({ page }) => {
    await page.goto(ALAMAT);
    await startScenario(page, "latihan");
    await expect(page.getByTestId("narration-line")).toBeVisible();
    await page.getByRole("link", { name: "Tutup percakapan" }).click();
    await expect(page).toHaveURL(/\/conversation$/);
  });
});

test.describe.serial("Memainkan skenario Perkenalan Diri", () => {
  let context: BrowserContext;
  let page: Page;
  const book: ChoiceBook = new Map();
  let xpAwal = 0;
  let xpDariTes = 0;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ baseURL: process.env.QA_STUDENT_URL?.replace(/\/+$/, "") || "http://localhost:5173", locale: "id-ID", timezoneId: "Asia/Jakarta" });
    page = await context.newPage();
    xpAwal = await weeklyXp(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("[TC-PC-04] mode Latihan dimainkan sampai selesai: hasil tampil dan Latihan tidak memberi XP", async () => {
    await page.goto(ALAMAT);
    const main = await playScenario(page, "latihan", book);
    expect(main.outcome).not.toBe("ditolak");
    expect(main.submissions).toBeGreaterThanOrEqual(2);
    const hasil = await readScenarioResult(page);
    expect(hasil.akurasi).toBe(Math.round((main.correct * 100) / main.submissions));
    expect(hasil.salah).toBe(main.wrong);
    expect(hasil.skor).toBeGreaterThanOrEqual(hasil.akurasi);
    expect(hasil.skor).toBeLessThanOrEqual(100);
    expect(hasil.xp, "Mode Latihan tidak memberi XP").toBe(0);
    await expect(page.getByRole("link", { name: "Coba Lagi" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Daftar Skenario" })).toBeVisible();
    expect(book.size, "Jawaban benar semua baris pilihan sudah dikenali").toBeGreaterThan(0);
  });

  test("[TC-PC-03] jawaban salah di Latihan: panel koreksi muncul dan Coba Lagi mengulang baris yang sama", async () => {
    await page.goto(ALAMAT);
    await startScenario(page, "latihan");
    await page.getByTestId("narration-line").getByTestId("next-button").click();

    const baris = page.getByTestId("choice-line");
    await expect(baris).toBeVisible();
    const pilihan = baris.getByTestId("choice-option");
    const teks = await pilihan.evaluateAll((els) => els.map((el) => el.getAttribute("data-text") ?? ""));
    const benar = book.get(teks.join(" | "));
    expect(benar, "Jawaban benar baris pertama seharusnya sudah dikenali dari putaran sebelumnya").toBeDefined();
    const salah = teks.findIndex((_, i) => i !== benar);
    const kemajuanSebelum = await page.getByRole("progressbar", { name: "Kemajuan percakapan" }).getAttribute("aria-valuenow");

    await pilihan.nth(salah).click();
    const panel = page.getByTestId("feedback");
    await expect(panel).toHaveAttribute("data-correct", "false");
    await expect(panel.getByRole("status")).toHaveText("Kurang tepat");
    await expect(panel.getByTestId("next-button")).toHaveText("Coba Lagi");
    for (const opsi of await pilihan.all()) await expect(opsi).toBeDisabled();

    await panel.getByTestId("next-button").click();
    await expect(panel).toHaveCount(0);
    // Baris yang sama muncul lagi, pilihan aktif kembali, kemajuan tidak bergeser.
    await expect(baris).toBeVisible();
    for (const opsi of await pilihan.all()) await expect(opsi).toBeEnabled();
    await expect(page.getByRole("progressbar", { name: "Kemajuan percakapan" })).toHaveAttribute("aria-valuenow", kemajuanSebelum ?? "0");
  });

  test("[TC-PC-05] di Latihan salah berkali-kali (lebih dari 3) tidak menghentikan sesi; hasilnya Belum Lulus", async () => {
    await page.goto(ALAMAT);
    const main = await playScenario(page, "latihan", book, { salahSengaja: 5 });
    expect(main.wrong).toBeGreaterThanOrEqual(5);
    expect(main.outcome, "Latihan tidak pernah berakhir dengan Kesempatan Habis").toBe("belum-lulus");
    const hasil = await readScenarioResult(page);
    expect(hasil.judul).toBe("Belum Lulus");
    expect(hasil.akurasi).toBeLessThan(80);
    expect(hasil.salah).toBe(main.wrong);
    expect(hasil.xp).toBe(0);
  });

  test("[TC-PC-06] di Tes, jawaban salah keempat menghentikan sesi dengan pesan Kesempatan Habis", async () => {
    await page.goto(ALAMAT);
    const main = await playScenario(page, "tes", book, { salahSengaja: 4 });
    expect(main.outcome).toBe("kesempatan-habis");
    expect(main.wrong).toBe(4);
    const hasil = await readScenarioResult(page);
    expect(hasil.judul).toBe("Kesempatan Habis");
    expect(hasil.salah).toBe(4);
    await expect(page.getByText("Terlalu banyak jawaban salah -- sesi tes berhenti di tengah jalan.")).toBeVisible();
    xpDariTes += hasil.xp;
  });

  test("[TC-PC-07] di Tes tanpa salah: Lulus, akurasi 100%, skor 100", async () => {
    await page.getByRole("link", { name: "Coba Lagi" }).click();
    await expect(page).toHaveURL(new RegExp(`${ALAMAT}$`));
    const main = await playScenario(page, "tes", book);
    expect(main.wrong).toBe(0);
    expect(main.outcome).toBe("lulus");
    const hasil = await readScenarioResult(page);
    expect(hasil.judul).toBe("Lulus!");
    expect(hasil.akurasi).toBe(100);
    expect(hasil.skor).toBe(100);
    expect(hasil.salah).toBe(0);
    xpDariTes += hasil.xp;
    await expectNoLeakedDebugText(page);
  });

  test("[TC-PC-08] XP dari Tes hanya diberikan satu kali per skenario dan sama dengan perubahan di peringkat", async () => {
    expect(xpDariTes, "XP Tes diberikan paling banyak sekali (20 XP) untuk satu skenario").toBeLessThanOrEqual(20);
    const xpAkhir = await weeklyXp(page);
    expect(xpAkhir - xpAwal, "Selisih XP di peringkat harus sama dengan jumlah XP yang tampil di layar hasil").toBe(xpDariTes);
  });
});
