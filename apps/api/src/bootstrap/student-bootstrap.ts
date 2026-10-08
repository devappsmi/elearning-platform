import { PASSWORD_LETTER_AND_DIGIT, PASSWORD_MIN_LENGTH } from "@elearning/domain";
import type { Prisma, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { isEmail } from "class-validator";
import { normalizeEmail } from "../common/email.util";

/** Pembuatan murid UJI langsung, TANPA undangan -- hanya untuk pengujian di server sendiri. Murid sungguhan tetap masuk lewat
 * undangan (email/tautan dari admin), karena undangan-lah yang membuktikan pemilik alamatnya. Dijalankan lewat
 * `pnpm run student:create` (prisma/create-student.ts, lihat docs/DEPLOY.md). Logika ada di sini (bukan di skripnya) supaya teruji.
 *
 * Yang dibuat SAMA dengan pendaftaran lewat undangan (AuthService.register): satu baris `User` dengan email baku, hash argon2id,
 * dan kelas. `User.classId` wajib, jadi murid selalu punya kelas -- lihat resolveClass. */

export class StudentBootstrapError extends Error {}

export interface StudentBootstrapInput {
  email: string;
  password: string;
  /** Nama tampilan. Kosong: akun baru bernama "Murid Uji", akun lama tidak diubah namanya. */
  name?: string;
  /** Nama kelas (tanpa membedakan huruf besar/kecil). Kosong: lihat resolveClass. Ada tetapi belum ada kelasnya: dibuat. */
  className?: string;
}

export interface StudentBootstrapResult {
  action: "created" | "updated";
  email: string;
  className: string;
  classCreated: boolean;
}

type StudentBootstrapDb = Pick<PrismaClient, "$transaction">;
type Tx = Prisma.TransactionClient;

const DEFAULT_STUDENT_NAME = "Murid Uji";
const DEFAULT_CLASS_NAME = "Kelas Uji";
const MAX_NAME_LENGTH = 100;
const MAX_LISTED_CLASSES = 10;

export async function createOrUpdateStudent(db: StudentBootstrapDb, input: StudentBootstrapInput): Promise<StudentBootstrapResult> {
  const email = normalizeEmail(input.email ?? "");
  if (!email || !isEmail(email)) throw new StudentBootstrapError("STUDENT_EMAIL kosong atau bukan alamat email yang valid.");

  const password = input.password ?? "";
  if (password.length < PASSWORD_MIN_LENGTH || !PASSWORD_LETTER_AND_DIGIT.test(password)) {
    throw new StudentBootstrapError(`STUDENT_PASSWORD minimal ${PASSWORD_MIN_LENGTH} karakter dan harus mengandung huruf dan angka.`);
  }

  const name = input.name?.trim() || undefined;
  if (name && name.length > MAX_NAME_LENGTH) throw new StudentBootstrapError(`STUDENT_NAME maksimal ${MAX_NAME_LENGTH} karakter.`);
  const className = input.className?.trim() || undefined;
  if (className && className.length > MAX_NAME_LENGTH) throw new StudentBootstrapError(`CLASS_NAME maksimal ${MAX_NAME_LENGTH} karakter.`);

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  // Satu transaksi: kelas yang baru dibuat tidak tertinggal sendirian bila pembuatan muridnya gagal.
  return db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email }, select: { id: true, classId: true, class: { select: { name: true } } } });

    if (!existing) {
      // "1 email = 1 undangan aktif": murid yang dibuat di sini lalu menerima undangan lama untuk email yang sama akan gagal
      // di batas unik email. Lebih jelas ditolak sekarang, dengan petunjuk.
      const pending = await tx.invitation.findFirst({ where: { email, status: "PENDING", expiresAt: { gt: new Date() } }, select: { id: true } });
      if (pending) {
        throw new StudentBootstrapError(
          `Email ${email} masih punya undangan PENDING. Cabut dulu undangannya di halaman Undangan admin, atau pakai email lain.`,
        );
      }
      const target = await resolveClass(tx, className);
      await tx.user.create({ data: { classId: target.id, email, name: name ?? DEFAULT_STUDENT_NAME, passwordHash } });
      return { action: "created", email, className: target.name, classCreated: target.created };
    }

    // Akun sudah ada dan CLASS_NAME kosong: kelasnya dibiarkan, jadi kelas lain (yang bisa saja banyak) tidak perlu dipilih.
    const target = className ? await resolveClass(tx, className) : null;
    // Kata sandi diganti = SEMUA sesi lama harus mati (sama seperti reset kata sandi murid), dan akun yang sempat dinonaktifkan
    // hidup lagi. Nama dan kelas hanya berubah bila diisi.
    await tx.user.update({
      where: { id: existing.id },
      data: { passwordHash, status: "ACTIVE", ...(name ? { name } : {}), ...(target ? { classId: target.id } : {}) },
    });
    await tx.refreshToken.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { action: "updated", email, className: target?.name ?? existing.class.name, classCreated: target?.created ?? false };
  });
}

interface ResolvedClass {
  id: string;
  name: string;
  created: boolean;
}

/** Kelas tujuan murid baru. `CLASS_NAME` diisi: kelas AKTIF bernama itu, atau dibuat bila belum ada. Kosong: satu-satunya kelas
 * aktif; belum ada kelas sama sekali -> "Kelas Uji" dibuat; beberapa kelas aktif -> berhenti dan minta `CLASS_NAME` (menebak
 * kelas mana yang dimaksud bisa memasukkan murid uji ke kelas sungguhan). Kelas ARSIP tidak menerima murid baru. */
async function resolveClass(tx: Tx, className: string | undefined): Promise<ResolvedClass> {
  if (className) {
    const named = await tx.class.findMany({ where: { name: { equals: className, mode: "insensitive" } }, select: { id: true, name: true, status: true } });
    const active = named.filter((c) => c.status === "ACTIVE");
    if (active.length === 1) return { id: active[0]!.id, name: active[0]!.name, created: false };
    if (active.length > 1) {
      throw new StudentBootstrapError(`Ada ${active.length} kelas aktif bernama "${className}". Pakai nama yang unik, atau ganti nama salah satunya di halaman Kelas admin.`);
    }
    if (named.length > 0) throw new StudentBootstrapError(`Kelas "${named[0]!.name}" sudah diarsipkan dan tidak menerima murid baru. Aktifkan lagi di halaman Kelas admin, atau pakai kelas lain.`);
    const created = await tx.class.create({ data: { name: className }, select: { id: true, name: true } });
    return { ...created, created: true };
  }

  const activeClasses = await tx.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  if (activeClasses.length === 1) return { ...activeClasses[0]!, created: false };
  if (activeClasses.length === 0) {
    const created = await tx.class.create({ data: { name: DEFAULT_CLASS_NAME }, select: { id: true, name: true } });
    return { ...created, created: true };
  }
  const listed = activeClasses.slice(0, MAX_LISTED_CLASSES).map((c) => `"${c.name}"`).join(", ");
  const more = activeClasses.length > MAX_LISTED_CLASSES ? `, dan ${activeClasses.length - MAX_LISTED_CLASSES} lainnya` : "";
  throw new StudentBootstrapError(`Ada ${activeClasses.length} kelas aktif (${listed}${more}). Isi CLASS_NAME dengan salah satunya.`);
}
