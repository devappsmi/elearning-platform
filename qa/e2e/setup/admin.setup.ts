import * as path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { loginAdmin } from "../support/auth";
import { cfg, missing } from "../support/env";

/** Masuk SEKALI sebagai admin uji lalu simpan sesinya untuk dipakai semua uji admin. */
setup("masuk sebagai admin uji", async ({ page }) => {
  expect(cfg.admin.email, missing("QA_ADMIN_EMAIL")).not.toBe("");
  expect(cfg.admin.password, missing("QA_ADMIN_PASSWORD")).not.toBe("");
  await loginAdmin(page);
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await page.context().storageState({ path: path.resolve(__dirname, "../../.auth/admin.json") });
});
