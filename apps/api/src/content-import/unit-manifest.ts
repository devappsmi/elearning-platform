import { resolve } from "node:path";
import type { LevelCode } from "@prisma/client";

/** Daftar unit konten yang di-seed ke database (`prisma/seed.ts`) -- SATU-SATUNYA tempat yang menentukan unit mana yang ada,
 * masuk level apa, dan (bila ditulis pengajar di Word) dari berkas sumber mana ia dihasilkan.
 *
 * Unit yang punya `source` dihasilkan dari template Word oleh `pnpm --filter api run unit:import <unitId>` (src/content-import,
 * panduan di docs/DEPLOY.md bagian 5b): berkas JSON di `file` adalah KELUARANNYA dan di-commit seperti unit lain, supaya seed
 * dan tes tidak butuh Word. Tes `unit-manifest.test.ts` menjaga keduanya tetap sinkron (JSON = hasil impor ulang sumbernya). */

export interface UnitManifestSource {
  /** Berkas Word dari pengajar (relatif terhadap prisma/seed-data). */
  docx: string;
  /** Perbaikan salah ketik dan pengganti manual untuk sumber itu (relatif terhadap prisma/seed-data). */
  overrides?: string;
  /** Id unit di database dan awalan id kosakata/kalimat/pelajaran (harus unik antarunit). */
  unitId: string;
  idPrefix: string;
  /** Nomor urut unit di dalam levelnya (mis. "Unit 3" di templatenya). */
  order: number;
  title?: string;
  description?: string;
}

export interface UnitManifestEntry {
  /** Berkas JSON unit (relatif terhadap prisma/seed-data). */
  file: string;
  /** Level (baris `levels`) tempat unit dimasukkan; dibuat bila belum ada. `order` = urutan level di jalur belajar (unik). */
  level: { code: LevelCode; name: string; order: number };
  source?: UnitManifestSource;
}

export const UNIT_MANIFEST: readonly UnitManifestEntry[] = [
  {
    file: "raw/unit_hiragana.json",
    level: { code: "HIRAGANA", name: "Hiragana", order: 1 },
  },
  {
    file: "raw/unit_kerja_3.json",
    // Tingkat di template "N4–N3"; kolom level baru mengenal sampai N4, jadi masuk N4.
    level: { code: "N4", name: "N4", order: 5 },
    source: {
      docx: "source/Percakapan_di_Tempat_Kerja_Unit_3.docx",
      overrides: "source/unit_kerja_3.overrides.json",
      unitId: "unit_kerja_3",
      idPrefix: "k3",
      order: 3,
    },
  },
];

/** Folder `prisma/seed-data`: dari `src/content-import` (ts-node/vitest) maupun `dist/content-import` (hasil build), dua tingkat
 * ke atas adalah akar paket API, tempat folder `prisma` berada. */
export const SEED_DATA_DIR = resolve(__dirname, "../../prisma/seed-data");

export function seedDataPath(relative: string): string {
  return resolve(SEED_DATA_DIR, relative);
}
