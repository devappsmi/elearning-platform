import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Pembantu untuk "mengerjakan pelajaran" lewat layar, tanpa tahu kunci jawabannya lebih dulu.
 *
 * Cara kerjanya: jawaban yang benar dibaca dari panel umpan balik yang tampil setelah tiap soal dijawab
 * (atribut data-correct-answer). Putaran pertama ("tebak") menjawab seadanya lalu mencatat jawaban yang benar;
 * putaran kedua ("sempurna") memakai catatan itu sehingga semua soal benar. Dengan begitu uji tetap jalan walau isi
 * pelajaran diganti penulis konten.
 */

/** Jawaban benar yang sudah diketahui. Kuncinya teks soal di layar. */
export type AnswerBook = Map<string, string>;

export type LessonMode = "tebak" | "sempurna";

export interface LessonRun {
  /** Jumlah jawaban yang dikirim, termasuk soal salah yang diulang di akhir. */
  submissions: number;
  correct: number;
  wrong: number;
  /** Jumlah soal berbeda yang dijumpai. */
  distinct: number;
  /** Layar yang muncul di akhir: hasil lulus, hasil belum lulus, atau pengiriman hasil ditolak server. */
  outcome: "lulus" | "belum-lulus" | "ditolak";
}

export interface AnswerResult {
  kind: "choose" | "assemble";
  key: string;
  correct: boolean;
  /** Jawaban yang benar menurut panel umpan balik. */
  answer: string;
}

/** Memecah jawaban "kata1 kata2 kata3" menjadi urutan kepingan dari bank (tiap keping dipakai sekali). Null bila tidak bisa. */
export function segmentAnswer(answer: string, bank: string[]): string[] | null {
  const used = new Array<boolean>(bank.length).fill(false);
  const out: string[] = [];
  const walk = (pos: number): boolean => {
    if (pos >= answer.length) return true;
    for (let i = 0; i < bank.length; i++) {
      const token = bank[i]!;
      if (used[i] || token.length === 0 || !answer.startsWith(token, pos)) continue;
      const end = pos + token.length;
      if (end !== answer.length && answer[end] !== " ") continue;
      used[i] = true;
      out.push(token);
      if (walk(end === answer.length ? end : end + 1)) return true;
      out.pop();
      used[i] = false;
    }
    return false;
  };
  return walk(0) ? out : null;
}

/** Teks soal (kalimat/huruf yang ditanyakan) dipakai sebagai kunci catatan jawaban. */
async function promptKey(card: Locator): Promise<string> {
  return (await card.locator(":scope > div").first().innerText()).replace(/\s+/g, " ").trim();
}

/** Menunggu sampai ada soal di layar. Mengembalikan jenis soal yang tampil. */
export async function waitForExercise(page: Page): Promise<"choose" | "assemble"> {
  const choose = page.getByTestId("choose-exercise");
  const assemble = page.getByTestId("assemble-exercise");
  await expect(choose.or(assemble)).toBeVisible({ timeout: 30_000 });
  return (await choose.isVisible()) ? "choose" : "assemble";
}

/**
 * Menjawab soal yang sedang tampil (belum menekan Lanjut). mode "tebak": soal yang belum dikenal dijawab seadanya.
 * mode "sempurna": memakai catatan jawaban. Jawaban benar dari panel umpan balik dicatat ke `book`.
 */
export async function answerCurrent(page: Page, book: AnswerBook, mode: LessonMode): Promise<AnswerResult> {
  const kind = await waitForExercise(page);
  let key: string;
  if (kind === "choose") {
    const card = page.getByTestId("choose-exercise");
    key = `choose|${await promptKey(card)}`;
    const options = card.getByTestId("choose-option");
    const texts = await options.evaluateAll((els) => els.map((el) => el.getAttribute("data-text") ?? ""));
    const known = book.get(key);
    let index = known !== undefined ? texts.indexOf(known) : -1;
    if (index < 0) index = mode === "tebak" ? texts.length - 1 : 0;
    await options.nth(index).click();
  } else {
    const card = page.getByTestId("assemble-exercise");
    key = `assemble|${await promptKey(card)}`;
    // Soal terakhir yang salah muncul lagi dengan susunan lama masih terisi: kosongkan dulu.
    const reset = card.getByRole("button", { name: "Ulangi" });
    if (await reset.isEnabled()) await reset.click();
    const bank = await card.getByTestId("bank-token").evaluateAll((els) => els.map((el) => el.getAttribute("data-text") ?? ""));
    const known = book.get(key);
    const order = (known !== undefined ? segmentAnswer(known, bank) : null) ?? [bank[0]!];
    const remaining = [...bank];
    for (const token of order) {
      const pos = remaining.indexOf(token);
      await card.getByTestId("bank-token").nth(pos).click();
      remaining.splice(pos, 1);
    }
    await card.getByTestId("check-button").click();
  }

  const feedback = page.getByTestId("feedback");
  await expect(feedback).toBeVisible();
  const answer = (await feedback.getAttribute("data-correct-answer")) ?? "";
  const correct = (await feedback.getAttribute("data-correct")) === "true";
  // Teks panel harus sejalan dengan hasilnya: benar -> "Benar!", salah -> "Kurang tepat" + jawaban yang benar.
  await expect(feedback.getByRole("status")).toHaveText(correct ? "Benar!" : "Kurang tepat");
  if (!correct) await expect(feedback).toContainText(`Jawaban yang benar: ${answer}`);
  book.set(key, answer);
  return { kind, key, correct, answer };
}

/** Menekan Lanjut di panel umpan balik dan menunggu panel itu hilang (soal berikutnya atau pengiriman hasil). */
export async function nextExercise(page: Page): Promise<void> {
  await page.getByTestId("feedback").getByTestId("next-button").click();
  await expect(page.getByTestId("feedback")).toHaveCount(0);
}

/**
 * Mengerjakan satu pelajaran sampai layar akhir muncul. Halaman harus sudah berada di /learn/<id>.
 * mode "tebak": soal yang belum dikenal dijawab seadanya (sering salah). mode "sempurna": memakai catatan jawaban.
 */
export async function playLesson(page: Page, book: AnswerBook, mode: LessonMode): Promise<LessonRun> {
  const run: LessonRun = { submissions: 0, correct: 0, wrong: 0, distinct: 0, outcome: "ditolak" };
  const seen = new Set<string>();
  const exercise = page.getByTestId("choose-exercise").or(page.getByTestId("assemble-exercise"));
  const result = page.getByRole("heading", { name: /^(Lulus!|Belum Lulus)$/ });
  const failedLoad = page.getByText("Gagal memuat pelajaran.");
  const rejected = page.getByText("Gagal mengirim hasil belajar.");

  for (let guard = 0; guard < 300; guard++) {
    await expect(exercise.or(result).or(failedLoad).or(rejected)).toBeVisible({ timeout: 30_000 });
    if (await failedLoad.isVisible()) throw new Error("Pelajaran gagal dimuat (Gagal memuat pelajaran.)");
    if (await rejected.isVisible()) {
      run.outcome = "ditolak";
      return run;
    }
    if (await result.isVisible()) {
      run.outcome = (await result.innerText()).trim() === "Lulus!" ? "lulus" : "belum-lulus";
      return run;
    }

    const answered = await answerCurrent(page, book, mode);
    seen.add(answered.key);
    run.submissions += 1;
    if (answered.correct) run.correct += 1;
    else run.wrong += 1;
    run.distinct = seen.size;
    await nextExercise(page);
  }
  throw new Error("Pelajaran tidak selesai setelah 300 langkah (kemungkinan macet atau berulang tanpa akhir)");
}

export interface LessonResultView {
  judul: "Lulus!" | "Belum Lulus";
  akurasi: number;
  /** Bintang hasil percobaan ini (hanya bila lulus), dibaca dari label "N dari 3 bintang". */
  bintang: number | null;
  /** XP yang diberikan pada percobaan ini; 0 bila tidak ada lencana XP. */
  xp: number;
  skorTerbaik: number;
  percobaan: number;
}

/** Membaca angka-angka di layar hasil pelajaran. */
export async function readLessonResult(page: Page): Promise<LessonResultView> {
  const judul = (await page.getByRole("heading", { name: /^(Lulus!|Belum Lulus)$/ }).innerText()).trim() as LessonResultView["judul"];
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const num = (pattern: RegExp, label: string): number => {
    const match = pattern.exec(text);
    if (!match) throw new Error(`Layar hasil tidak memuat ${label}. Isi layar: ${text.slice(0, 300)}`);
    return Number(match[1]);
  };
  const stars = page.getByRole("img", { name: /^\d dari 3 bintang$/ }).first();
  const bintang = judul === "Lulus!" ? Number(/^(\d)/.exec((await stars.getAttribute("aria-label")) ?? "")?.[1] ?? NaN) : null;
  const xp = /\+(\d+) XP/.exec(text);
  return {
    judul,
    akurasi: num(/Akurasi: (\d+)%/, "akurasi"),
    bintang,
    xp: xp ? Number(xp[1]) : 0,
    skorTerbaik: num(/Skor terbaik\s*(\d+)%/, "skor terbaik"),
    percobaan: num(/Jumlah percobaan\s*(\d+)/, "jumlah percobaan"),
  };
}
