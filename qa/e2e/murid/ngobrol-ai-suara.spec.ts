import { expect, test, type Page } from "@playwright/test";
import { cfg } from "../support/env";

/**
 * Ngobrol dengan AI: rekam suara memakai mikrofon palsu bawaan Chromium (bunyi uji, bukan ucapan sungguhan).
 * Hanya jalan bila QA_AI_SUARA=1. Terhadap AI sungguhan, bunyi uji biasanya tidak dikenali sebagai ucapan, jadi hasil yang
 * dianggap benar adalah salah satu dari: teks hasil pengenalan muncul, atau pesan "tidak terdengar jelas". Terhadap AI tiruan,
 * teks hasil pengenalan muncul. Kode [TC-..] = kasus di buku kasus uji.
 * Berkas ini terpisah karena pilihan peluncuran peramban (mikrofon palsu) tidak bisa diubah di dalam grup uji.
 */

test.skip(cfg.ai === "off" || !cfg.aiVoice, "Isi QA_AI_SUARA=1 di qa/.env untuk menjalankan uji rekam suara dengan mikrofon palsu.");

test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

async function mulaiNgobrol(page: Page): Promise<void> {
  await page.goto("/conversation/ngobrol-ai");
  await expect(page.getByTestId("start-chat")).toBeVisible();
  await page.getByTestId("start-chat").click();
  await expect(page.getByTestId("empty-chat")).toBeVisible();
}

test("[TC-AI-12] merekam lalu berhenti: suara dikenali jadi teks yang bisa diperiksa sebelum dikirim", { tag: "@ai" }, async ({ page }) => {
  await mulaiNgobrol(page);
  const mic = page.getByTestId("mic-button");
  await expect(mic).toBeEnabled();
  await mic.click();
  await expect(page.getByText(/^Merekam \d+:\d{2} dari \d+:\d{2}/)).toBeVisible();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(2000);
  await mic.click();

  const terisi = page.getByText("Begini yang terdengar. Perbaiki kalau ada yang salah, lalu kirim.");
  const tidakJelas = page.getByRole("alert").filter({ hasText: /Suaramu tidak terdengar jelas|belum bisa dikenali|Fitur suara belum diaktifkan/ });
  await expect(terisi.or(tidakJelas)).toBeVisible({ timeout: 60_000 });
  if (await terisi.isVisible()) {
    await expect(page.getByTestId("chat-input")).not.toHaveValue("");
    await expect(page.getByTestId("send-button")).toBeEnabled();
  }
});
