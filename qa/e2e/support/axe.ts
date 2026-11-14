import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

/** Pelanggaran yang sudah diketahui dan dicatat sebagai temuan (tidak menggagalkan uji, tetapi tetap muncul di laporan). */
export interface KnownA11yIssue {
  aturan: string;
  /** Potongan selektor elemen yang dimaksud, mis. ".ml-1". */
  target: string;
  alasan: string;
}

/**
 * Memindai halaman dengan axe-core (aturan WCAG 2.1 A/AA). Pelanggaran tingkat serius dan kritis menggagalkan uji;
 * temuan tingkat ringan dan sedang dilampirkan ke laporan sebagai catatan tetapi tidak menggagalkan.
 * `diketahui`: pelanggaran yang sudah dicatat sebagai temuan; ia dikeluarkan dari penilaian dan diberi anotasi "temuan".
 */
export async function scanAccessibility(page: Page, testInfo: TestInfo, label: string, diketahui: KnownA11yIssue[] = []): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForLoadState("networkidle");
  const hasil = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

  const ringkas = hasil.violations.map((v) => {
    const sisa = v.nodes.filter((node) => !diketahui.some((k) => k.aturan === v.id && node.target.join(" ").includes(k.target)));
    const dikenal = v.nodes.length - sisa.length;
    return {
      aturan: v.id,
      dampak: v.impact,
      bantuan: v.help,
      jumlahElemen: v.nodes.length,
      elemenBaru: sisa.length,
      elemenDiketahui: dikenal,
      contoh: sisa.slice(0, 3).map((n) => n.target.join(" ")),
      rujukan: v.helpUrl,
    };
  });
  for (const k of diketahui) {
    if (ringkas.some((r) => r.aturan === k.aturan && r.elemenDiketahui > 0)) {
      testInfo.annotations.push({ type: "temuan", description: `${label}: ${k.aturan} pada "${k.target}" (${k.alasan})` });
    }
  }
  await testInfo.attach(`axe-${label}.json`, { body: JSON.stringify(ringkas, null, 2), contentType: "application/json" });

  const berat = ringkas.filter((v) => (v.dampak === "serious" || v.dampak === "critical") && v.elemenBaru > 0);
  expect(berat, `${label}: pelanggaran aksesibilitas serius/kritis:\n${JSON.stringify(berat, null, 2)}`).toEqual([]);
}
