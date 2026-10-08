import { expect, test } from "@playwright/test";
import { loginAdmin } from "../support/auth";
import { cfg } from "../support/env";

/** Aplikasi admin: layar Masuk dan perlindungan halaman. Kode [TC-..] = kasus di buku kasus uji. */

const SALAH = "Email atau password salah.";

test.describe("Masuk ke aplikasi admin", () => {
  test("[TC-AD-01] masuk dengan akun admin yang benar membuka Dashboard", { tag: "@smoke" }, async ({ page }) => {
    test.skip(!cfg.admin.email, "QA_ADMIN_EMAIL belum diisi");
    await loginAdmin(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Murid aktif minggu ini")).toBeVisible();
    await expect(page.getByText(/^Halo, /)).toBeVisible();
    await expect(page.getByRole("button", { name: "Keluar" })).toBeVisible();
  });

  test("[TC-AD-02] password salah ditolak dengan pesan yang jelas", async ({ page }) => {
    test.skip(!cfg.admin.email, "QA_ADMIN_EMAIL belum diisi");
    await page.goto("/login");
    await page.getByLabel("Email").fill(cfg.admin.email);
    await page.getByLabel("Password").fill("PasswordSalah123");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByText(SALAH)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("[TC-AD-03] akun murid tidak bisa masuk di aplikasi admin", async ({ page }) => {
    test.skip(!cfg.student.email, "QA_STUDENT_EMAIL belum diisi");
    await page.goto("/login");
    await page.getByLabel("Email").fill(cfg.student.email);
    await page.getByLabel("Password").fill(cfg.student.password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByText(SALAH)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("[TC-AD-04] isian kosong atau email berformat salah ditahan di browser dan tidak dikirim ke server", async ({ page }) => {
    let loginCalls = 0;
    page.on("request", (request) => {
      if (request.url().includes("/admin/auth/login")) loginCalls += 1;
    });
    await page.goto("/login");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await page.getByLabel("Email").fill("bukan-email");
    await page.getByLabel("Password").fill("x");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await page.waitForTimeout(800);
    expect(loginCalls, "Isian tidak valid seharusnya ditahan di browser").toBe(0);
    await expect(page).toHaveURL(/\/login/);
  });

  test("[TC-AD-05] belum masuk: semua halaman admin mengarah ke layar Masuk", { tag: "@smoke" }, async ({ page }) => {
    for (const path of ["/", "/invitations", "/classes", "/students", "/students/tidak-ada", "/settings"]) {
      await page.goto(path);
      await expect(page, `Halaman ${path} seharusnya mengarah ke /login`).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();
    }
  });
});
