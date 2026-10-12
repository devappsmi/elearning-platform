/** Membuat murid UJI langsung, tanpa undangan (atau memulihkan kata sandinya) -- hanya untuk pengujian; lihat docs/DEPLOY.md.
 *
 *   STUDENT_EMAIL=murid@contoh.id STUDENT_PASSWORD='...' [STUDENT_NAME='Nama'] [CLASS_NAME='Nama Kelas'] \
 *     pnpm run student:create
 *
 * Kata sandi dibaca dari ENVIRONMENT (bukan argumen baris perintah) supaya tidak tampil di daftar proses;
 * tidak pernah dicetak. Akun yang sudah ada diperbarui kata sandinya dan sesi lamanya dicabut. */
import { PrismaClient } from "@prisma/client";
import { StudentBootstrapError, createOrUpdateStudent } from "../src/bootstrap/student-bootstrap";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const result = await createOrUpdateStudent(prisma, {
    email: process.env.STUDENT_EMAIL ?? "",
    password: process.env.STUDENT_PASSWORD ?? "",
    name: process.env.STUDENT_NAME,
    className: process.env.CLASS_NAME,
  });
  const verb = result.action === "created" ? "dibuat" : "diperbarui (kata sandi diganti, sesi lama dicabut)";
  const klass = `kelas "${result.className}"${result.classCreated ? " (kelas baru dibuat)" : ""}`;
  console.log(`Murid ${result.email} ${verb}, ${klass}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof StudentBootstrapError ? `GAGAL: ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
