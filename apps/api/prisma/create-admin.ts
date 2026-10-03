/** Membuat admin pertama (atau memulihkan kata sandi admin) -- lihat docs/DEPLOY.md.
 *
 *   ADMIN_EMAIL=admin@contoh.id ADMIN_PASSWORD='...' [ADMIN_NAME='Nama'] [INSTITUTION_NAME='Nama Lembaga'] \
 *     pnpm run admin:create
 *
 * Kata sandi dibaca dari ENVIRONMENT (bukan argumen baris perintah) supaya tidak tampil di daftar proses;
 * tidak pernah dicetak. Akun yang sudah ada diperbarui kata sandinya dan sesi lamanya dicabut. */
import { PrismaClient } from "@prisma/client";
import { AdminBootstrapError, createOrUpdateAdmin } from "../src/bootstrap/admin-bootstrap";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const result = await createOrUpdateAdmin(prisma, {
    email: process.env.ADMIN_EMAIL ?? "",
    password: process.env.ADMIN_PASSWORD ?? "",
    name: process.env.ADMIN_NAME,
    institutionName: process.env.INSTITUTION_NAME,
  });
  const verb = result.action === "created" ? "dibuat" : "diperbarui (kata sandi diganti, sesi lama dicabut)";
  console.log(`Admin ${result.email} ${verb}.${result.institution === "set" ? " Nama lembaga disimpan." : ""}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof AdminBootstrapError ? `GAGAL: ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
