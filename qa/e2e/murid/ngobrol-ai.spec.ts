import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { cfg } from "../support/env";

/**
 * Ngobrol dengan AI (/conversation/ngobrol-ai).
 *
 * Bagian pertama tidak memakai layanan AI sama sekali (aman dijalankan kapan saja). Bagian kedua mengirim pesan sungguhan
 * dan memakai jatah harian murid uji (1 jatah per balasan, bukan per pesan suara). Atur lewat QA_AI di qa/.env:
 *   auto (bawaan) = bagian kedua dilewati bila server belum punya kunci AI;  on = gagal bila AI belum aktif;  off = lewati semua.
 * Uji rekam suara dengan mikrofon palsu ada di berkas terpisah (ngobrol-ai-suara.spec.ts). Kode [TC-..] = kasus di buku kasus uji.
 */

const ALAMAT = "/conversation/ngobrol-ai";

async function bukaPengaturan(page: Page): Promise<void> {
  await page.goto(ALAMAT);
  await expect(page.getByTestId("start-chat")).toBeVisible();
}

async function mulaiNgobrol(page: Page): Promise<void> {
  await bukaPengaturan(page);
  await page.getByTestId("start-chat").click();
  await expect(page.getByTestId("empty-chat")).toBeVisible();
}

async function sisaJatah(page: Page): Promise<number> {
  const label = (await page.getByTestId("quota-chip").getAttribute("aria-label")) ?? (await page.getByTestId("quota-chip").innerText());
  return Number(/(\d+)\s*(dari|$)/.exec(label.replace(/^.*?:\s*/, ""))?.[1] ?? /Sisa\s*(\d+)/.exec(label)?.[1]);
}

test.describe("Ngobrol dengan AI: pengaturan dan layar chat (tanpa memakai jatah)", { tag: "@ai" }, () => {
  test.skip(cfg.ai === "off", "QA_AI=off: uji Ngobrol dengan AI dilewati.");

  test("[TC-AI-01] kartu di halaman Percakapan membuka layar pengaturan: situasi, teman bicara, dan sisa jatah", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/conversation");
    await page.getByTestId("open-ai-chat").click();
    await expect(page).toHaveURL(new RegExp(`${ALAMAT}$`));
    await expect(page.getByRole("heading", { name: "Ngobrol dengan AI", exact: true })).toBeVisible();
    await expect(page.getByText("Cara kerjanya")).toBeVisible();
    await expect(page.getByRole("group", { name: "Pilih situasi" }).getByRole("radio").first()).toBeChecked();
    await expect(page.getByRole("group", { name: "Pilih teman bicara" }).getByRole("radio").first()).toBeChecked();
    await expect(page.getByTestId("quota-chip")).toHaveText(/^Sisa jatah hari ini: \d+ dari \d+ balasan$/);
    await expect(page.getByRole("link", { name: "Kembali ke Percakapan" })).toBeVisible();
  });

  test("[TC-AI-02] memilih situasi dan teman bicara lain tercermin di layar chat", async ({ page }) => {
    await bukaPengaturan(page);
    const grupSituasi = page.getByRole("group", { name: "Pilih situasi" });
    const grupTeman = page.getByRole("group", { name: "Pilih teman bicara" });
    const situasi = grupSituasi.getByRole("radio");
    const teman = grupTeman.getByRole("radio");
    if ((await situasi.count()) < 2) test.skip(true, "Hanya ada satu situasi di data ini.");
    await situasi.nth(1).check({ force: true });
    await expect(situasi.nth(1)).toBeChecked();
    await expect(situasi.nth(0)).not.toBeChecked();
    const judul = (await grupSituasi.locator("label").nth(1).locator("span.text-base").first().innerText()).trim();
    let namaTeman = "";
    if ((await teman.count()) >= 2) {
      await teman.nth(1).check({ force: true });
      namaTeman = (await grupTeman.locator("label").nth(1).locator("span.text-base").first().innerText()).trim();
    }
    await page.getByTestId("start-chat").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(judul);
    if (namaTeman) await expect(page.getByText(`Bersama ${namaTeman}`)).toBeVisible();
  });

  test("[TC-AI-03] layar chat kosong menawarkan contoh kalimat pembuka yang bisa dipakai", async ({ page }) => {
    await mulaiNgobrol(page);
    await expect(page.getByText(/^Mulai dengan menyapa /)).toBeVisible();
    const contoh = page.getByTestId("empty-chat").locator("p[lang=ja]");
    await expect(contoh).toBeVisible();
    const kalimat = (await contoh.innerText()).trim();
    expect(kalimat.length).toBeGreaterThan(0);
    await expect(page.getByTestId("chat-input")).toHaveValue("");
    await page.getByTestId("use-opener").click();
    await expect(page.getByTestId("chat-input")).toHaveValue(kalimat);
    await expect(page.getByTestId("send-button")).toBeEnabled();
  });

  test("[TC-AI-04] pesan kosong atau hanya spasi tidak bisa dikirim", async ({ page }) => {
    await mulaiNgobrol(page);
    const kirim = page.getByTestId("send-button");
    await expect(kirim).toBeDisabled();
    await page.getByTestId("chat-input").fill("     ");
    await expect(kirim).toBeDisabled();
    await page.getByTestId("chat-input").fill("こんにちは");
    await expect(kirim).toBeEnabled();
    await page.getByTestId("chat-input").fill("");
    await expect(kirim).toBeDisabled();
  });

  test("[TC-AI-05] kolom ketik dibatasi 500 karakter", async ({ page }) => {
    await mulaiNgobrol(page);
    const kolom = page.getByTestId("chat-input");
    await expect(kolom).toHaveAttribute("maxlength", "500");
    await kolom.fill("あ".repeat(600));
    expect(Array.from(await kolom.inputValue()).length).toBeLessThanOrEqual(500);
  });

  test("[TC-AI-06] tombol suara balasan bisa dimatikan dan dinyalakan", async ({ page }) => {
    await mulaiNgobrol(page);
    const tombol = page.getByTestId("sound-toggle");
    await expect(tombol).toHaveAttribute("aria-pressed", "true");
    await expect(tombol).toHaveAccessibleName("Matikan suara balasan");
    await tombol.click();
    await expect(tombol).toHaveAttribute("aria-pressed", "false");
    await expect(tombol).toHaveAccessibleName("Nyalakan suara balasan");
  });

  test("[TC-AI-07] Selesai ngobrol kembali ke pengaturan dan memulai lagi menghasilkan percakapan kosong", async ({ page }) => {
    await mulaiNgobrol(page);
    await page.getByTestId("use-opener").click();
    await page.getByTestId("end-chat").click();
    await expect(page.getByTestId("start-chat")).toBeVisible();
    await page.getByTestId("start-chat").click();
    await expect(page.getByTestId("empty-chat")).toBeVisible();
    await expect(page.getByTestId("chat-input")).toHaveValue("");
    await expect(page.getByTestId("user-message")).toHaveCount(0);
  });

  test("[TC-AI-08] rekam suara tanpa mikrofon atau tanpa izin: muncul penjelasan dan mengetik tetap bisa", async ({ page }) => {
    await mulaiNgobrol(page);
    const mic = page.getByTestId("mic-button");
    if (await mic.isDisabled()) {
      // Peramban/alamat yang tidak mendukung rekam: tombol mati dan ada penjelasan di layar.
      await expect(page.getByText(/Rekam suara hanya berfungsi lewat alamat HTTPS|belum mendukung rekam suara/)).toBeVisible();
    } else {
      await mic.click();
      await expect(page.getByRole("alert").filter({ hasText: /Izin mikrofon ditolak|Mikrofon tidak ditemukan|Mikrofon tidak bisa dipakai/ })).toBeVisible();
    }
    await page.getByTestId("chat-input").fill("こんにちは");
    await expect(page.getByTestId("send-button")).toBeEnabled();
  });
});

test.describe.serial("Ngobrol dengan AI: balasan sungguhan (memakai jatah harian)", { tag: "@ai" }, () => {
  test.skip(cfg.ai === "off", "QA_AI=off: uji Ngobrol dengan AI dilewati.");

  let context: BrowserContext;
  let page: Page;
  let aiAktif = true;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ baseURL: cfg.studentUrl, locale: "id-ID", timezoneId: "Asia/Jakarta" });
    page = await context.newPage();
    await mulaiNgobrol(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("[TC-AI-09] mengirim pesan: pesan murid tampil, AI membalas, dan sisa jatah berkurang satu", async () => {
    const sebelum = await sisaJatah(page);
    test.skip(cfg.ai === "auto" && sebelum <= 0, "Jatah harian murid uji sudah habis.");
    expect(sebelum, "Jatah harian murid uji habis. Tunggu besok atau pakai murid uji lain.").toBeGreaterThan(0);

    await page.getByTestId("use-opener").click();
    const kalimat = await page.getByTestId("chat-input").inputValue();
    await page.getByTestId("send-button").click();
    await expect(page.getByTestId("user-message")).toContainText(kalimat);

    const balasan = page.getByTestId("ai-message");
    const belumAktif = page.getByRole("alert").filter({ hasText: "belum diaktifkan di server ini" });
    await expect(balasan.first().or(belumAktif)).toBeVisible({ timeout: 60_000 });
    if (await belumAktif.isVisible()) {
      aiAktif = false;
      expect(cfg.ai, "QA_AI=on tetapi server belum punya kunci AI").not.toBe("on");
      // Pesan yang gagal dikembalikan ke kolom ketik supaya bisa dikirim lagi.
      await expect(page.getByTestId("chat-input")).toHaveValue(kalimat);
      await expect(page.getByTestId("user-message")).toHaveCount(0);
      test.skip(true, "Server belum punya kunci AI (QA_AI=auto): uji balasan dilewati. Kasus TC-AI-14 mencatat pesan ini.");
    }

    await expect(balasan.first()).not.toHaveText("");
    await expect(balasan.first()).toContainText(/\S/);
    expect(await sisaJatah(page)).toBe(sebelum - 1);
    // Suara balasan: tombol Dengarkan (suara aktif) atau penjelasan bahwa suara belum tersedia.
    await expect(page.getByTestId("play-reply").or(page.getByText("Suara belum tersedia untuk balasan ini.")).first()).toBeVisible({ timeout: 30_000 });
  });

  test("[TC-AI-10] Minta contoh jawaban menampilkan kartu contoh dan memakai satu jatah", async () => {
    test.skip(!aiAktif, "AI belum aktif di server ini.");
    const sebelum = await sisaJatah(page);
    await page.getByTestId("help-button").click();
    const kartu = page.getByTestId("tip-message");
    await expect(kartu).toBeVisible({ timeout: 60_000 });
    await expect(kartu).toContainText(/^Contoh jawaban dari /);
    await expect(kartu).toContainText(/\S{3,}/);
    expect(await sisaJatah(page)).toBe(sebelum - 1);
  });

  test("[TC-AI-11] sisa jatah di layar pengaturan sama dengan di layar chat", async () => {
    test.skip(!aiAktif, "AI belum aktif di server ini.");
    const diChat = await sisaJatah(page);
    await page.getByTestId("end-chat").click();
    await expect(page.getByTestId("start-chat")).toBeVisible();
    const teks = await page.getByTestId("quota-chip").innerText();
    const cocok = /Sisa jatah hari ini: (\d+) dari (\d+) balasan/.exec(teks);
    expect(cocok, `Chip jatah tidak terbaca: ${teks}`).not.toBeNull();
    expect(Number(cocok![1])).toBe(diChat);
  });
});
