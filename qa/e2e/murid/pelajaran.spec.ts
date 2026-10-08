import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { expectNoLeakedDebugText } from "../support/auth";
import { cfg } from "../support/env";
import {
  answerCurrent,
  nextExercise,
  playLesson,
  readLessonResult,
  waitForExercise,
  type AnswerBook,
  type LessonResultView,
  type LessonRun,
} from "../support/lesson";

/**
 * Belajar: mengerjakan pelajaran, umpan balik tiap soal, layar hasil, bintang, XP.
 * Pelajaran yang dimainkan = QA_LESSON_ID (bawaan l1, pelajaran pertama Hiragana). Kode [TC-..] = kasus di buku kasus uji.
 */

const PELAJARAN = `/learn/${cfg.lessonId}`;

async function jumlahSelesai(page: Page): Promise<number> {
  const teks = await page.getByText(/^Pelajaran selesai\s*\d+\/\d+$/).innerText();
  return Number(/(\d+)\//.exec(teks)![1]);
}

async function bukaBeranda(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^Selamat datang, / })).toBeVisible();
  await expect(page.locator("ol > li").first()).toBeVisible();
}

test.describe("Layar pelajaran", () => {
  test("[TC-PL-01] pelajaran terbuka dengan soal, bilah kemajuan 0, dan tombol tutup", { tag: "@smoke" }, async ({ page }) => {
    await page.goto(PELAJARAN);
    const jenis = await waitForExercise(page);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("");
    await expect(page.getByRole("progressbar", { name: "Kemajuan pelajaran" })).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByRole("link", { name: "Tutup pelajaran" })).toBeVisible();
    if (jenis === "assemble") await expect(page.getByTestId("check-button")).toBeDisabled();
    else expect(await page.getByTestId("choose-option").count()).toBeGreaterThanOrEqual(2);
    await expectNoLeakedDebugText(page);
  });

  test("[TC-PL-02] menjawab satu soal: panel umpan balik tampil, jawaban terkunci, tombol Lanjut menggeser ke soal berikutnya", async ({ page }) => {
    await page.goto(PELAJARAN);
    const hasil = await answerCurrent(page, new Map(), "tebak");
    await expect(page.getByTestId("next-button")).toHaveText("Lanjut");
    if (hasil.kind === "choose") {
      for (const opsi of await page.getByTestId("choose-option").all()) await expect(opsi).toBeDisabled();
    } else {
      await expect(page.getByTestId("check-button")).toHaveCount(0);
    }
    await nextExercise(page);
    await waitForExercise(page);
    // Jawaban salah tidak menambah kemajuan; jawaban benar menambahnya.
    const bilah = page.getByRole("progressbar", { name: "Kemajuan pelajaran" });
    if (hasil.correct) await expect(bilah).not.toHaveAttribute("aria-valuenow", "0");
    else await expect(bilah).toHaveAttribute("aria-valuenow", "0");
  });

  test("[TC-PL-03] tombol Tutup (X) membawa murid kembali ke Beranda tanpa menyimpan hasil", async ({ page }) => {
    await bukaBeranda(page);
    const selesaiSebelum = await jumlahSelesai(page);
    await page.goto(PELAJARAN);
    await answerCurrent(page, new Map(), "tebak");
    await page.getByRole("link", { name: "Tutup pelajaran" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("ol > li").first()).toBeVisible();
    expect(await jumlahSelesai(page)).toBe(selesaiSebelum);
  });

  test("[TC-PL-04] memuat ulang halaman di tengah pelajaran memulai lagi dari awal", async ({ page }) => {
    await page.goto(PELAJARAN);
    await answerCurrent(page, new Map(), "tebak");
    await nextExercise(page);
    await page.reload();
    await waitForExercise(page);
    await expect(page.getByRole("progressbar", { name: "Kemajuan pelajaran" })).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByTestId("feedback")).toHaveCount(0);
  });

  test("[TC-PL-08] membuka alamat layar hasil secara langsung mengarahkan ke Beranda", async ({ page }) => {
    await page.goto(`${PELAJARAN}/result`);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /^Selamat datang, / })).toBeVisible();
  });

  test("[TC-PL-09] pelajaran yang punya catatan tata bahasa: tombol Catatan membuka dan menutup panelnya", async ({ page }) => {
    // Pelajaran pertama unit "Percakapan di Tempat Kerja" (N4) memuat catatan tata bahasa.
    await page.goto("/learn/k3_l1");
    await waitForExercise(page);
    const tombol = page.getByRole("button", { name: "Catatan" });
    if ((await tombol.count()) === 0) test.skip(true, "Pelajaran k3_l1 tidak punya catatan di data ini.");
    const panel = page.getByRole("region", { name: "Catatan tata bahasa" });
    await expect(tombol).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toHaveCount(0);
    await tombol.click();
    await expect(tombol).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { level: 2 }).first()).not.toHaveText("");
    await tombol.click();
    await expect(panel).toHaveCount(0);
  });
});

test.describe.serial("Mengerjakan satu pelajaran dari awal sampai lulus", () => {
  let context: BrowserContext;
  let page: Page;
  const book: AnswerBook = new Map();
  let pertamaKali = false;
  let selesaiSebelum = 0;
  let putaran1: LessonRun;
  let hasil1: LessonResultView;
  let hasil2: LessonResultView;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ baseURL: cfg.studentUrl, locale: "id-ID", timezoneId: "Asia/Jakarta" });
    page = await context.newPage();
    await bukaBeranda(page);
    selesaiSebelum = await jumlahSelesai(page);
    const tautan = page.locator(`a[href="${PELAJARAN}"]`);
    const status = (await tautan.count()) > 0 ? await tautan.locator(".sr-only").innerText() : "terkunci";
    if (/terkunci/.test(status)) throw new Error(`Pelajaran ${cfg.lessonId} masih terkunci untuk akun uji. Pakai QA_LESSON_ID pelajaran yang sudah terbuka.`);
    pertamaKali = !/selesai/.test(status);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("[TC-PL-05] putaran pertama (menebak): soal yang salah diulang di akhir dan akurasi dihitung dari semua jawaban", async () => {
    await page.goto(PELAJARAN);
    putaran1 = await playLesson(page, book, "tebak");
    expect(putaran1.outcome, "Pengiriman hasil seharusnya diterima server").not.toBe("ditolak");
    expect(putaran1.wrong, "Menebak seharusnya menghasilkan beberapa jawaban salah").toBeGreaterThan(0);
    // Tiap jawaban salah mengulang soalnya satu kali di akhir (dijawab benar karena jawabannya sudah diketahui).
    expect(putaran1.submissions).toBe(putaran1.distinct + putaran1.wrong);
    hasil1 = await readLessonResult(page);
    expect(hasil1.akurasi).toBe(Math.round((putaran1.correct * 100) / putaran1.submissions));
    expect(hasil1.judul).toBe(hasil1.akurasi >= 80 ? "Lulus!" : "Belum Lulus");
  });

  test("[TC-PL-06] layar hasil menjelaskan lulus atau belum lulus dan menawarkan Coba Lagi serta Kembali ke Beranda", async () => {
    await expect(page.getByRole("link", { name: "Coba Lagi" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kembali ke Beranda" })).toBeVisible();
    await expect(page.getByText("Skor terbaik")).toBeVisible();
    await expect(page.getByText("Jumlah percobaan")).toBeVisible();
    if (hasil1.judul === "Belum Lulus") {
      await expect(page.getByText("Jangan menyerah, coba sekali lagi ya!")).toBeVisible();
      expect(hasil1.xp, "Belum lulus tidak boleh memberi XP").toBe(0);
      expect(hasil1.bintang, "Belum lulus tidak menampilkan bintang").toBeNull();
    } else {
      expect(hasil1.bintang).toBeGreaterThanOrEqual(1);
    }
    await expectNoLeakedDebugText(page);
  });

  test("[TC-PL-07] tombol Coba Lagi mengulang pelajaran dari soal pertama", async () => {
    await page.getByRole("link", { name: "Coba Lagi" }).click();
    await expect(page).toHaveURL(new RegExp(`${PELAJARAN}$`));
    await waitForExercise(page);
    await expect(page.getByRole("progressbar", { name: "Kemajuan pelajaran" })).toHaveAttribute("aria-valuenow", "0");
  });

  test("[TC-PL-10] putaran kedua tanpa salah: Lulus, akurasi 100%, tiga bintang, XP hanya sekali", async () => {
    const putaran2 = await playLesson(page, book, "sempurna");
    expect(putaran2.wrong, "Dengan jawaban yang sudah diketahui seharusnya tidak ada yang salah").toBe(0);
    expect(putaran2.outcome).toBe("lulus");
    hasil2 = await readLessonResult(page);
    expect(hasil2.judul).toBe("Lulus!");
    expect(hasil2.akurasi).toBe(100);
    expect(hasil2.bintang).toBe(3);
    expect(hasil2.skorTerbaik).toBe(100);
    expect(hasil2.percobaan, "Jumlah percobaan bertambah satu tiap hasil dikirim").toBe(hasil1.percobaan + 1);
    // XP hanya diberikan saat pelajaran pertama kali lulus (putaran 1 atau 2), tidak dua kali.
    if (pertamaKali) expect(hasil1.xp + hasil2.xp, "XP pelajaran pertama kali lulus").toBeGreaterThan(0);
    else expect(hasil2.xp, "Pelajaran yang sudah pernah lulus tidak memberi XP lagi").toBe(0);
    if (hasil1.judul === "Lulus!" && pertamaKali) expect(hasil2.xp).toBe(0);
  });

  test("[TC-NL-01] Beranda mencerminkan kemajuan: pelajaran selesai bertambah, bintang tampil, pelajaran berikutnya terbuka", async () => {
    await page.getByRole("link", { name: "Kembali ke Beranda" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("ol > li").first()).toBeVisible();
    const tautan = page.locator(`a[href="${PELAJARAN}"]`);
    await expect(tautan.locator(".sr-only")).toContainText("selesai, 3 bintang");
    expect(await jumlahSelesai(page)).toBe(selesaiSebelum + (pertamaKali ? 1 : 0));
    if (cfg.lessonId === "l1") {
      await expect(page.locator('ol a[href="/learn/l2"]'), "Pelajaran berikutnya (l2) harus sudah terbuka").toHaveCount(1);
      await expect(page.getByRole("link", { name: /Lanjutkan Belajar/ })).toHaveAttribute("href", /\/learn\/(?!l1$)/);
    }
  });

  test("[TC-NL-02] streak mulai dihitung dan XP masuk ke peringkat mingguan", async () => {
    await expect(page.getByText(/^Streak\s*\d+\s*hari$/)).toBeVisible();
    const streak = Number(/(\d+)/.exec(await page.getByText(/^Streak\s*\d+\s*hari$/).innerText())![1]);
    expect(streak, "Setelah belajar hari ini streak minimal 1").toBeGreaterThanOrEqual(1);

    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: "Peringkat Minggu Ini" })).toBeVisible();
    const barisku = page.locator("li, tr").filter({ hasText: "(kamu)" }).first();
    await expect(barisku).toBeVisible();
    const teks = (await barisku.innerText()).replace(/\s+/g, " ");
    const xp = /(\d+)\s*XP/.exec(teks) ? Number(/(\d+)\s*XP/.exec(teks)![1]) : Number([...teks.matchAll(/\d+/g)].pop()![0]);
    expect(xp, "XP murid di peringkat harus sama atau lebih besar dari XP yang baru didapat").toBeGreaterThanOrEqual(hasil1.xp + hasil2.xp);
  });

  test("[TC-NL-03] mengulang pelajaran yang sudah lulus tidak memberi XP lagi dan skor terbaik tidak turun", async () => {
    await page.goto(PELAJARAN);
    const ulang = await playLesson(page, book, "sempurna");
    expect(ulang.outcome).toBe("lulus");
    const hasil3 = await readLessonResult(page);
    expect(hasil3.xp, "Mengulang pelajaran yang sudah lulus tidak memberi XP").toBe(0);
    expect(hasil3.skorTerbaik).toBe(100);
    expect(hasil3.percobaan).toBe(hasil2.percobaan + 1);
  });
});
