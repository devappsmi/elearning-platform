import * as path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { loginStudent } from "../support/auth";
import { cfg, missing } from "../support/env";

/** Masuk SEKALI sebagai murid uji lalu simpan sesinya untuk dipakai semua uji murid (menghemat permintaan ke server). */
setup("masuk sebagai murid uji", async ({ page }) => {
  expect(cfg.student.email, missing("QA_STUDENT_EMAIL")).not.toBe("");
  expect(cfg.student.password, missing("QA_STUDENT_PASSWORD")).not.toBe("");
  await loginStudent(page);
  await expect(page.getByRole("link", { name: "Keluar" }).or(page.getByRole("button", { name: "Keluar" })).first()).toBeVisible();
  await page.context().storageState({ path: path.resolve(__dirname, "../../.auth/murid.json") });
});
