/** Impor unit konten dari template Word pengajar: `pnpm --filter api run unit:import <unitId> [--check]`.
 *
 * Membaca berkas .docx sumber unit itu (daftar dan lokasinya di src/content-import/unit-manifest.ts), membangun JSON unit
 * (kosakata, kalimat, catatan, pelajaran + latihan) dan menulisnya ke berkas JSON unit di prisma/seed-data/raw. Setelah itu
 * `pnpm run db:seed` yang memasukkannya ke database. TIDAK menyentuh database. Panduan: docs/DEPLOY.md, bagian 5b.
 *
 *   unit:import                  daftar unit yang punya sumber Word
 *   unit:import unit_kerja_3     buat ulang prisma/seed-data/raw/unit_kerja_3.json dari sumbernya, cetak ringkasan + peringatan
 *   unit:import unit_kerja_3 --check   tidak menulis; keluar dengan kode 1 bila JSON yang tersimpan tidak sama dengan hasil impor
 *
 * Logikanya ada di src/content-import (teruji); berkas ini hanya pembungkus baris perintah. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describeImport, generateUnit, isImportable } from "../src/content-import/unit-import";
import { seedDataPath, UNIT_MANIFEST } from "../src/content-import/unit-manifest";

function run(args: readonly string[]): number {
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const importable = UNIT_MANIFEST.filter(isImportable);

  const unknownFlags = [...flags].filter((flag) => flag !== "--check");
  if (unknownFlags.length > 0) {
    console.error(`GAGAL: opsi tidak dikenal: ${unknownFlags.join(", ")}. Yang ada: --check.`);
    return 1;
  }

  const [unitId] = positional;
  if (!unitId) {
    console.log("Unit yang punya sumber Word (pnpm --filter api run unit:import <unitId>):");
    for (const entry of importable) console.log(`  ${entry.source.unitId}  <-  ${entry.source.docx}  ->  ${entry.file}`);
    return 0;
  }

  const entry = importable.find((candidate) => candidate.source.unitId === unitId);
  if (!entry) {
    console.error(`GAGAL: unit "${unitId}" tidak punya sumber Word di manifest. Pilihan: ${importable.map((e) => e.source.unitId).join(", ") || "(kosong)"}.`);
    return 1;
  }

  let generated;
  try {
    generated = generateUnit(entry);
  } catch (error) {
    console.error(`GAGAL mengimpor ${unitId}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  for (const line of describeImport(generated)) console.log(line);

  const target = seedDataPath(entry.file);
  if (flags.has("--check")) {
    const current = existsSync(target) ? readFileSync(target, "utf-8") : null;
    if (current === generated.json) {
      console.log(`${entry.file} sudah sama dengan hasil impor.`);
      return 0;
    }
    console.error(`${entry.file} TIDAK sama dengan hasil impor sumbernya -- jalankan \`pnpm --filter api run unit:import ${unitId}\` lalu periksa diff-nya.`);
    return 1;
  }
  writeFileSync(target, generated.json);
  console.log(`Ditulis: ${entry.file}. Berikutnya: periksa diff-nya, lalu \`pnpm run db:seed\` untuk memasukkannya ke database.`);
  return 0;
}

process.exitCode = run(process.argv.slice(2).filter((arg) => arg !== "--"));
