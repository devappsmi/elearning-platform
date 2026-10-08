import { expect, type Page } from "@playwright/test";

/** XP murid yang sedang masuk pada peringkat minggu ini (0 bila belum ada di peringkat). Membuka halaman Leaderboard. */
export async function weeklyXp(page: Page): Promise<number> {
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "Peringkat Minggu Ini" })).toBeVisible();
  const kosong = page.getByText("Belum ada aktivitas XP minggu ini di kelasmu.");
  const barisku = page.locator("li, tr").filter({ hasText: "(kamu)" }).first();
  await expect(kosong.or(barisku)).toBeVisible();
  if (await kosong.isVisible()) return 0;
  const teks = (await barisku.innerText()).replace(/\s+/g, " ");
  const xp = /(\d+)\s*XP/.exec(teks);
  // Baris tabel menampilkan XP sebagai angka terakhir; podium menulis "N XP".
  return xp ? Number(xp[1]) : Number([...teks.matchAll(/\d+/g)].pop()![0]);
}
