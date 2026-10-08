import { expect, test } from "@playwright/test";
import { loginStudent, pageText } from "../support/auth";
import { cfg } from "../support/env";

/** Halaman murid yang tidak butuh login: masuk, lupa password, tautan undangan dan reset. Kode [TC-..] = kasus di buku kasus uji. */

const SALAH = "Email atau password salah.";
const TERKUNCI = /terlalu banyak percobaan gagal.*15 menit/i;

test.describe("Masuk ke aplikasi murid", () => {
  test("[TC-AK-08] masuk dengan email dan password benar", { tag: "@smoke" }, async ({ page }) => {
    test.skip(!cfg.student.email, "QA_STUDENT_EMAIL belum diisi");
    await loginStudent(page);
    await expect(page).toHaveURL(/\/($|welcome)/);
    await expect(page.getByRole("button", { name: "Keluar" }).first()).toBeVisible();
  });

  test("[TC-AK-09] password salah ditolak dengan pesan yang jelas", async ({ page }) => {
    test.skip(!cfg.student.email, "QA_STUDENT_EMAIL belum diisi");
    await page.goto("/login");
    await page.getByLabel("Email").fill(cfg.student.email);
    await page.getByLabel("Password").fill("PasswordSalah123");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(SALAH);
    await expect(page).toHaveURL(/\/login/);
  });

  test("[TC-AK-10] email yang tidak terdaftar mendapat pesan yang sama (tidak membocorkan siapa yang terdaftar)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(`tidak-ada-${Date.now()}@example.com`);
    await page.getByLabel("Password").fill("PasswordSalah123");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(SALAH);
  });

  test("[TC-AK-11] isian kosong atau berformat salah tidak dikirim ke server", async ({ page }) => {
    let loginCalls = 0;
    page.on("request", (request) => {
      if (request.url().includes("/auth/login")) loginCalls += 1;
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

  test("[TC-AK-14] akun admin tidak bisa masuk di aplikasi murid", async ({ page }) => {
    test.skip(!cfg.admin.email, "QA_ADMIN_EMAIL belum diisi");
    await page.goto("/login");
    await page.getByLabel("Email").fill(cfg.admin.email);
    await page.getByLabel("Password").fill(cfg.admin.password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(SALAH);
  });

  test("[TC-AK-15] akun terkunci setelah 5 kali salah password, juga untuk password yang benar", async ({ page }) => {
    test.skip(!cfg.lockout.email, "QA_LOCKOUT_EMAIL belum diisi (akun khusus uji penguncian)");
    await page.goto("/login");
    let locked = false;
    for (let attempt = 1; attempt <= 6 && !locked; attempt++) {
      await page.getByLabel("Email").fill(cfg.lockout.email);
      await page.getByLabel("Password").fill(`SalahTerus${attempt}`);
      await page.getByRole("button", { name: "Masuk", exact: true }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      locked = TERKUNCI.test((await page.getByRole("alert").innerText()) ?? "");
    }
    expect(locked, "Setelah 5 kali salah, pesan harus menyebut akun terkunci selama 15 menit").toBe(true);

    await page.getByLabel("Password").fill(cfg.lockout.password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(TERKUNCI);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Halaman yang dilindungi", () => {
  const dilindungi = ["/", "/profile", "/learn/l1", "/conversation", "/conversation/ngobrol-ai", "/dictionary", "/flashcards", "/leaderboard", "/welcome"];

  test("[TC-AK-13] belum masuk: semua halaman belajar mengarahkan ke layar Masuk", { tag: "@smoke" }, async ({ page }) => {
    for (const path of dilindungi) {
      await page.goto(path);
      await expect(page, `Halaman ${path} seharusnya mengarah ke /login`).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();
    }
  });
});

test.describe("Tautan undangan dan reset password", () => {
  test("[TC-AK-04] tautan undangan yang tidak dikenal menampilkan pesan yang jelas", async ({ page }) => {
    await page.goto(`/invite/token-ngawur-${Date.now()}`);
    await expect(page.getByText("Tautan undangan tidak valid")).toBeVisible();
    await expect(page.getByText("Tautan ini tidak dikenali")).toBeVisible();
    // Tidak ada formulir pendaftaran yang bisa diisi.
    await expect(page.getByLabel(/nama lengkap/i)).toHaveCount(0);
  });

  test("[TC-AK-16] lupa password: jawaban sama untuk email terdaftar maupun tidak", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(`qa-lupa-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /Kirim Tautan Reset/ }).click();
    await expect(page.getByText("Cek Emailmu")).toBeVisible();
    await expect(page.getByText(/Kalau .* terdaftar, kami sudah mengirim tautan/)).toBeVisible();
    await expect(page.getByText(/berlaku 1 jam/)).toBeVisible();
  });

  test("[TC-AK-19] tautan reset yang tidak berlaku menampilkan pesan dan jalan keluar", async ({ page }) => {
    await page.goto(`/reset-password/token-ngawur-${Date.now()}`);
    await page.getByLabel("Password baru", { exact: true }).fill("PasswordBaru123");
    await page.getByLabel("Konfirmasi password baru").fill("PasswordBaru123");
    await page.locator("form button[type=submit]").click();
    await expect(page.getByText("Tautan Reset Tidak Berlaku")).toBeVisible();
    await expect(page.getByText(/berlaku 1 jam dan satu kali pakai/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Minta Tautan Reset Baru" })).toBeVisible();
  });
});
