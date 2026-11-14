import { expect, test } from "@playwright/test";
import { expectNoLeakedDebugText, loginStudent } from "../support/auth";
import { cfg } from "../support/env";

/** Tes penempatan dikerjakan sampai selesai oleh murid BARU (QA_MURID_BARU_*). Semua soal dijawab "Belum tahu", sehingga
 *  hasilnya pasti: mulai dari awal jalur. Alur LULUS butuh jawaban benar dan diuji manual (TC-AK-34). Setelah uji ini
 *  akun tersebut sudah "terpakai" (tes hanya sekali). Kode [TC-..] = kasus di buku kasus uji. */

test.describe("Tes penempatan: murid baru", () => {
  test("[TC-AK-33] mengerjakan tes dengan \"Belum tahu\" semua: mulai dari awal, tawaran hilang, hasil tersimpan", async ({ page }) => {
    test.skip(!cfg.freshStudent.email, "QA_MURID_BARU_EMAIL belum diisi (akun baru khusus uji tes penempatan)");
    await loginStudent(page, cfg.freshStudent);
    await page.goto("/placement");
    await expect(page.getByTestId("placement-intro").or(page.getByTestId("placement-taken")).or(page.getByTestId("placement-unavailable"))).toBeVisible();
    test.skip(
      await page.getByTestId("placement-taken").isVisible(),
      "Akun QA_MURID_BARU sudah pernah ikut tes penempatan. Buat akun baru (student:create) lalu isi ulang QA_MURID_BARU_*.",
    );
    test.skip(
      await page.getByTestId("placement-unavailable").isVisible(),
      "Tes penempatan tidak tersedia untuk akun ini (fitur dimatikan lewat PLACEMENT_TEST_ENABLED, atau akun sudah menyelesaikan pelajaran).",
    );

    await page.getByTestId("placement-start").click();
    const counter = page.getByTestId("placement-counter");
    await expect(counter).toHaveText(/^Soal 1 dari \d+$/);
    const total = Number(/dari (\d+)/.exec(await counter.innerText())![1]);
    expect(total).toBeGreaterThan(0);

    for (let i = 1; i <= total; i++) {
      await expect(counter).toHaveText(`Soal ${i} dari ${total}`);
      await expect(page.getByTestId("placement-option")).toHaveCount(4);
      await expect(page.getByTestId("placement-next")).toBeDisabled();
      await page.getByText("Belum tahu", { exact: true }).click();
      if (i === 2) {
        // Mundur satu soal: pilihan soal 1 masih tercentang.
        await page.getByTestId("placement-prev").click();
        await expect(counter).toHaveText(`Soal 1 dari ${total}`);
        await expect(page.getByTestId("placement-unknown")).toBeChecked();
        await page.getByTestId("placement-next").click();
        await expect(page.getByTestId("placement-unknown")).toBeChecked();
      }
      await expect(page.getByTestId("placement-next")).toHaveText(i === total ? "Kirim jawaban" : "Lanjut");
      await page.getByTestId("placement-next").click();
    }

    const result = page.getByTestId("placement-result");
    await expect(result).toHaveAttribute("data-passed", "false");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kita mulai dari awal");
    await expect(page.getByTestId("placement-score")).toHaveText(`0 dari ${total} jawaban benar`);
    await expect(page.getByTestId("placement-start-unit")).toContainText("Kamu mulai dari");
    await expectNoLeakedDebugText(page);

    await page.getByRole("button", { name: /Mulai belajar/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/^Pelajaran selesai\s*0\/\d+$/)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("placement-offer-card")).toHaveCount(0);
    await expect(page.getByTestId("unit-skipped")).toHaveCount(0);
    await expect(page.getByTestId("kana-intro-card")).toBeVisible();

    await page.goto("/placement");
    await expect(page.getByTestId("placement-taken")).toContainText(`Hasil: 0 dari ${total} jawaban benar.`);
    await expect(page.getByTestId("placement-start")).toHaveCount(0);
  });
});
