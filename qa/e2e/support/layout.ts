import { expect, type Page } from "@playwright/test";

/** Halaman tidak boleh bergulir ke samping (tanda ada elemen yang melebihi lebar layar). */
export async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const lebih = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(lebih, `${label}: halaman bergulir ke samping sejauh ${lebih}px`).toBeLessThanOrEqual(1);
}

/** Setiap elemen yang cocok harus punya area sentuh minimal `min` piksel (anjuran 44, batas keras WCAG 24). */
export async function expectTapTargets(page: Page, selector: string, label: string, min = 40): Promise<void> {
  const ukuran = await page.locator(selector).evaluateAll((els) =>
    els
      .filter((el) => {
        const box = (el as HTMLElement).getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      })
      .map((el) => {
        const box = (el as HTMLElement).getBoundingClientRect();
        return { teks: (el.textContent ?? "").trim().slice(0, 30), lebar: Math.round(box.width), tinggi: Math.round(box.height) };
      }),
  );
  expect(ukuran.length, `${label}: tidak ada elemen yang cocok dengan ${selector}`).toBeGreaterThan(0);
  const kecil = ukuran.filter((u) => u.lebar < min || u.tinggi < min);
  expect(kecil, `${label}: area sentuh lebih kecil dari ${min}px: ${JSON.stringify(kecil)}`).toEqual([]);
}
