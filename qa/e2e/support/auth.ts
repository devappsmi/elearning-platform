import { expect, type Page } from "@playwright/test";
import { cfg, type Credentials } from "./env";

/** Masuk lewat layar Masuk aplikasi murid (seperti murid sungguhan). */
export async function loginStudent(page: Page, creds: Credentials = cfg.student): Promise<void> {
  await page.goto(`${cfg.studentUrl}/login`);
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Masuk lewat layar Masuk aplikasi admin. */
export async function loginAdmin(page: Page, creds: Credentials = cfg.admin): Promise<void> {
  await page.goto(`${cfg.adminUrl}/login`);
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: /masuk/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Teks seluruh halaman, spasi dirapikan. Dipakai untuk memeriksa pesan tanpa terikat susunan elemen. */
export async function pageText(page: Page): Promise<string> {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
}

/** Pastikan tidak ada teks sisa pengembang yang bocor ke layar (nilai kosong, galat mentah, templat). */
export async function expectNoLeakedDebugText(page: Page): Promise<void> {
  const text = await pageText(page);
  for (const bad of ["undefined", "[object Object]", "NaN", "null", "Traceback", "Internal Server Error", "lorem ipsum"]) {
    expect(text, `Layar memuat teks mencurigakan "${bad}"`).not.toContain(bad);
  }
}
