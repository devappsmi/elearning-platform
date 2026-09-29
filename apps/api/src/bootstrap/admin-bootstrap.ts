import { PASSWORD_LETTER_AND_DIGIT, PASSWORD_MIN_LENGTH } from "@elearning/domain";
import type { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { isEmail } from "class-validator";
import { normalizeEmail } from "../common/email.util";

/** Pembuatan admin PERTAMA (dan pemulihan kata sandi admin) untuk instalasi baru. Tidak ada endpoint
 * pendaftaran admin -- admin sengaja hanya bisa dibuat dari luar aplikasi -- jadi tanpa ini instalasi
 * kosong tidak punya cara masuk ke panel admin. Dijalankan lewat `pnpm run admin:create`
 * (prisma/create-admin.ts, lihat docs/DEPLOY.md). Logika ada di sini (bukan di skripnya) supaya teruji. */

export class AdminBootstrapError extends Error {}

export interface AdminBootstrapInput {
  email: string;
  password: string;
  /** Nama tampilan. Kosong: akun baru bernama "Admin", akun lama tidak diubah namanya. */
  name?: string;
  /** Nama lembaga (baris `Institution` tunggal). Kosong: tidak menyentuh baris lembaga. */
  institutionName?: string;
}

export interface AdminBootstrapResult {
  action: "created" | "updated";
  email: string;
  institution: "set" | "unchanged";
}

type AdminBootstrapDb = Pick<PrismaClient, "adminUser" | "adminRefreshToken" | "institution" | "$transaction">;

const DEFAULT_ADMIN_NAME = "Admin";
const MAX_NAME_LENGTH = 100;
const INSTITUTION_ID = "singleton"; // baris tunggal, lihat model Institution

export async function createOrUpdateAdmin(db: AdminBootstrapDb, input: AdminBootstrapInput): Promise<AdminBootstrapResult> {
  const email = normalizeEmail(input.email ?? "");
  if (!email || !isEmail(email)) throw new AdminBootstrapError("ADMIN_EMAIL kosong atau bukan alamat email yang valid.");

  const password = input.password ?? "";
  if (password.length < PASSWORD_MIN_LENGTH || !PASSWORD_LETTER_AND_DIGIT.test(password)) {
    throw new AdminBootstrapError(`ADMIN_PASSWORD minimal ${PASSWORD_MIN_LENGTH} karakter dan harus mengandung huruf dan angka.`);
  }

  const name = input.name?.trim() || undefined;
  if (name && name.length > MAX_NAME_LENGTH) throw new AdminBootstrapError(`ADMIN_NAME maksimal ${MAX_NAME_LENGTH} karakter.`);
  const institutionName = input.institutionName?.trim() || undefined;

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const existing = await db.adminUser.findUnique({ where: { email } });

  let action: AdminBootstrapResult["action"];
  if (existing) {
    // Kata sandi diganti = SEMUA sesi lama harus mati (sama seperti reset kata sandi murid), dan akun yang
    // sempat dinonaktifkan hidup lagi -- ini jalur pemulihan kalau satu-satunya admin lupa kata sandinya.
    await db.$transaction([
      db.adminUser.update({ where: { id: existing.id }, data: { passwordHash, isActive: true, ...(name ? { name } : {}) } }),
      db.adminRefreshToken.updateMany({ where: { adminUserId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    action = "updated";
  } else {
    await db.adminUser.create({ data: { email, name: name ?? DEFAULT_ADMIN_NAME, passwordHash, role: "OWNER" } });
    action = "created";
  }

  if (institutionName) {
    await db.institution.upsert({
      where: { id: INSTITUTION_ID },
      create: { id: INSTITUTION_ID, name: institutionName },
      update: { name: institutionName },
    });
  }

  return { action, email, institution: institutionName ? "set" : "unchanged" };
}
