import { expect, type Page } from "@playwright/test";

/**
 * Pembantu untuk memainkan skenario Percakapan lewat layar, tanpa tahu kunci jawabannya lebih dulu.
 * Layar percakapan tidak membuka jawaban yang benar, jadi jawaban dipelajari dengan mencoba pilihan satu per satu
 * (mode Latihan boleh mengulang tanpa batas). Setelah dipelajari, mode Tes bisa dimainkan tanpa salah.
 */

/** Pilihan yang benar per baris dialog. Kunci = teks semua pilihan di baris itu, nilai = nomor pilihan yang benar. */
export type ChoiceBook = Map<string, number>;

export type ScenarioMode = "latihan" | "tes";

export interface ScenarioRun {
  /** Jumlah jawaban yang dikirim (benar + salah). */
  submissions: number;
  correct: number;
  wrong: number;
  outcome: "lulus" | "belum-lulus" | "kesempatan-habis" | "ditolak";
}

export interface PlayOptions {
  /** Jumlah jawaban salah yang SENGAJA dibuat (pada baris yang jawaban benarnya sudah diketahui). */
  salahSengaja?: number;
}

export interface ScenarioResultView {
  judul: "Lulus!" | "Belum Lulus" | "Kesempatan Habis";
  akurasi: number;
  skor: number;
  salah: number;
  /** XP yang diberikan percobaan ini; 0 bila tidak ada lencana XP. */
  xp: number;
}

/** Dari layar pengantar skenario: mulai dengan mode yang dipilih. */
export async function startScenario(page: Page, mode: ScenarioMode): Promise<void> {
  await page.getByTestId(mode === "latihan" ? "start-practice" : "start-test").click();
}

/** Memainkan skenario sampai layar akhir. Halaman harus berada di layar pengantar /conversation/<id>. */
export async function playScenario(page: Page, mode: ScenarioMode, book: ChoiceBook, options: PlayOptions = {}): Promise<ScenarioRun> {
  const run: ScenarioRun = { submissions: 0, correct: 0, wrong: 0, outcome: "ditolak" };
  const tried = new Map<string, Set<number>>();
  let sengaja = options.salahSengaja ?? 0;

  await startScenario(page, mode);

  const narration = page.getByTestId("narration-line");
  const choice = page.getByTestId("choice-line");
  const result = page.getByRole("heading", { name: /^(Lulus!|Belum Lulus|Kesempatan Habis)$/ });
  const rejected = page.getByText("Gagal mengirim hasil percakapan.");

  for (let guard = 0; guard < 200; guard++) {
    await expect(narration.or(choice).or(result).or(rejected)).toBeVisible({ timeout: 30_000 });
    if (await rejected.isVisible()) return run;
    if (await result.isVisible()) {
      const judul = (await result.innerText()).trim();
      run.outcome = judul === "Lulus!" ? "lulus" : judul === "Belum Lulus" ? "belum-lulus" : "kesempatan-habis";
      return run;
    }

    if (await narration.isVisible()) {
      await narration.getByTestId("next-button").click();
      continue;
    }

    const buttons = choice.getByTestId("choice-option");
    const texts = await buttons.evaluateAll((els) => els.map((el) => el.getAttribute("data-text") ?? ""));
    const key = texts.join(" | ");
    const known = book.get(key);
    let index: number;
    if (known === undefined) {
      const done = tried.get(key) ?? new Set<number>();
      index = texts.findIndex((_, i) => !done.has(i));
      if (index < 0) throw new Error(`Semua pilihan sudah dicoba tetapi tidak ada yang benar untuk baris: ${key}`);
    } else if (sengaja > 0 && texts.length > 1) {
      index = texts.findIndex((_, i) => i !== known);
      sengaja -= 1;
    } else {
      index = known;
    }
    await buttons.nth(index).click();

    const feedback = page.getByTestId("feedback");
    await expect(feedback).toBeVisible();
    const correct = (await feedback.getAttribute("data-correct")) === "true";
    await expect(feedback.getByRole("status")).toHaveText(correct ? "Benar!" : "Kurang tepat");
    run.submissions += 1;
    if (correct) {
      run.correct += 1;
      book.set(key, index);
    } else {
      run.wrong += 1;
      tried.set(key, (tried.get(key) ?? new Set<number>()).add(index));
    }
    await feedback.getByTestId("next-button").click();
    await expect(feedback).toHaveCount(0);
  }
  throw new Error("Skenario tidak selesai setelah 200 langkah (kemungkinan macet atau berulang tanpa akhir)");
}

/** Membaca angka-angka di layar hasil percakapan. */
export async function readScenarioResult(page: Page): Promise<ScenarioResultView> {
  const judul = (await page.getByRole("heading", { name: /^(Lulus!|Belum Lulus|Kesempatan Habis)$/ }).innerText()).trim() as ScenarioResultView["judul"];
  // innerText mengikuti CSS (judul kecil tampil KAPITAL), jadi pola dibaca tanpa peduli besar-kecil huruf.
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const num = (pattern: RegExp, label: string): number => {
    const match = pattern.exec(text);
    if (!match) throw new Error(`Layar hasil tidak memuat ${label}. Isi layar: ${text.slice(0, 300)}`);
    return Number(match[1]);
  };
  const xp = /\+(\d+) XP/.exec(text);
  return {
    judul,
    akurasi: num(/Akurasi\s*(\d+)%/i, "akurasi"),
    skor: num(/Skor\s*(\d+)/i, "skor"),
    salah: num(/Jawaban salah\s*(\d+)/i, "jumlah jawaban salah"),
    xp: xp ? Number(xp[1]) : 0,
  };
}
