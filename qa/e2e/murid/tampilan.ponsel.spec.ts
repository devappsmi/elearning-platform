import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, expectTapTargets } from "../support/layout";
import { waitForExercise } from "../support/lesson";

/**
 * Tampilan di layar ponsel (emulasi Pixel 7, 412x915). Emulasi membantu menangkap tata letak yang pecah, tetapi tidak
 * menggantikan uji di ponsel sungguhan (lihat tab Perangkat di buku kasus uji). Kode [TC-..] = kasus di buku kasus uji.
 */

const MENU_TAB = ["Beranda", "Percakapan", "Kamus", "Flashcard", "Leaderboard"] as const;

test.describe("Aplikasi murid di ponsel", () => {
  test("[TC-RS-01] Beranda memakai tab bawah (bukan sidebar), tanpa gulir ke samping", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /^Selamat datang, / })).toBeVisible();
    const tab = page.getByRole("navigation", { name: "Menu utama" }).filter({ visible: true });
    await expect(tab).toHaveCount(1);
    for (const nama of MENU_TAB) await expect(tab.getByRole("link", { name: nama, exact: true })).toBeVisible();
    await expect(tab.getByRole("link", { name: "Profil", exact: true })).toHaveCount(0);
    await expect(page.locator("aside")).toBeHidden();
    await expectNoHorizontalScroll(page, "Beranda");
  });

  test("[TC-RS-02] tab bawah, avatar (Profil), dan tombol Keluar tersedia di bilah atas dan mudah disentuh", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /^Selamat datang, / })).toBeVisible();
    await expectTapTargets(page, 'nav[aria-label="Menu utama"] a:visible', "Tab bawah", 44);
    await expect(page.getByRole("link", { name: "Profil", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Keluar" })).toBeVisible();
    const tab = page.getByRole("navigation", { name: "Menu utama" }).filter({ visible: true });
    for (const [nama, url] of [["Percakapan", /\/conversation$/], ["Kamus", /\/dictionary$/], ["Flashcard", /\/flashcards$/], ["Leaderboard", /\/leaderboard$/]] as const) {
      await tab.getByRole("link", { name: nama, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expectNoHorizontalScroll(page, nama);
    }
    await page.getByRole("link", { name: "Profil", exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expectNoHorizontalScroll(page, "Profil");
  });

  test("[TC-RS-03] layar pelajaran di ponsel: soal, pilihan, dan tombol terlihat utuh serta cukup besar untuk disentuh", async ({ page }) => {
    await page.goto("/learn/l1");
    const jenis = await waitForExercise(page);
    await expectNoHorizontalScroll(page, "Pelajaran");
    if (jenis === "choose") {
      await expectTapTargets(page, '[data-testid="choose-option"]', "Pilihan jawaban", 44);
    } else {
      await expectTapTargets(page, '[data-testid="bank-token"]', "Kepingan kata", 40);
    }
    await expect(page.getByRole("link", { name: "Tutup pelajaran" })).toBeVisible();
    const tab = page.getByRole("navigation", { name: "Menu utama" }).filter({ visible: true });
    // Tab bawah tidak boleh menutupi pilihan jawaban.
    const kotakTab = (await tab.boundingBox())!;
    const pilihan = page.getByTestId(jenis === "choose" ? "choose-option" : "bank-token");
    const jumlah = await pilihan.count();
    for (let i = 0; i < jumlah; i++) {
      const kotak = (await pilihan.nth(i).boundingBox())!;
      expect(kotak.y + kotak.height, "Pilihan jawaban tertutup tab bawah").toBeLessThanOrEqual(kotakTab.y + 1);
    }
  });

  test("[TC-RS-04] Kamus di ponsel: kotak cari dan hasil satu kolom tanpa gulir ke samping", async ({ page }) => {
    await page.goto("/dictionary");
    await page.locator("#dictionary-search").fill("a");
    const kartu = page.locator("main div.grid > div");
    await expect(kartu.first()).toBeVisible();
    await expectNoHorizontalScroll(page, "Kamus");
    const kiri = await kartu.first().evaluate((el) => Math.round(el.getBoundingClientRect().left));
    const kiri2 = await kartu.nth(1).evaluate((el) => Math.round(el.getBoundingClientRect().left));
    expect(kiri2, "Kartu hasil di ponsel seharusnya satu kolom").toBe(kiri);
  });

  test("[TC-RS-05] layar Ngobrol dengan AI di ponsel: kotak kirim tidak tertutup tab bawah dan tidak ada gulir ke samping", async ({ page }) => {
    await page.goto("/conversation/ngobrol-ai");
    await page.getByTestId("start-chat").click();
    await expect(page.getByTestId("empty-chat")).toBeVisible();
    await expectNoHorizontalScroll(page, "Ngobrol dengan AI");
    const kirim = (await page.getByTestId("send-button").boundingBox())!;
    const tab = (await page.getByRole("navigation", { name: "Menu utama" }).filter({ visible: true }).boundingBox())!;
    expect(kirim.y + kirim.height, "Tombol kirim tertutup tab bawah").toBeLessThanOrEqual(tab.y + 1);
    expect(kirim.width, "Tombol kirim terlalu kecil untuk disentuh").toBeGreaterThanOrEqual(44);
    const mic = (await page.getByTestId("mic-button").boundingBox())!;
    expect(mic.width).toBeGreaterThanOrEqual(44);
    await page.getByTestId("chat-input").fill("こんにちは");
    await expect(page.getByTestId("send-button")).toBeEnabled();
  });

  test("[TC-RS-06] Profil di ponsel: formulir bisa diisi dan tombol Simpan terjangkau", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.locator("#profile-name")).toBeVisible();
    await expectNoHorizontalScroll(page, "Profil");
    await page.getByRole("button", { name: "Simpan Perubahan" }).scrollIntoViewIfNeeded();
    const simpan = (await page.getByRole("button", { name: "Simpan Perubahan" }).boundingBox())!;
    const tab = (await page.getByRole("navigation", { name: "Menu utama" }).filter({ visible: true }).boundingBox())!;
    expect(simpan.y + simpan.height, "Tombol Simpan tertutup tab bawah setelah digulir").toBeLessThanOrEqual(tab.y + 1);
  });

  test("[TC-RS-07] Leaderboard dan Flashcard di ponsel tidak melebar", async ({ page }) => {
    for (const alamat of ["/leaderboard", "/flashcards", "/conversation", `/conversation/perkenalan`]) {
      await page.goto(alamat);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalScroll(page, alamat);
    }
  });
});
