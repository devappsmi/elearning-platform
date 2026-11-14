import type { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminBootstrapError, createOrUpdateAdmin } from "./admin-bootstrap";

interface StoredAdmin {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "OWNER" | "STAFF";
  isActive: boolean;
}

function fakeDb(existing: StoredAdmin | null = null) {
  const db = {
    adminUser: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { email: string } }) => Promise.resolve(existing && existing.email === where.email ? existing : null)),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    adminRefreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    institution: { upsert: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db, prisma: db as any as PrismaClient };
}

const VALID = { email: "admin@contoh.id", password: "Rahasia123" };
const EXISTING: StoredAdmin = { id: "adm1", email: "admin@contoh.id", name: "Bu Guru", passwordHash: "lama", role: "STAFF", isActive: false };

let fake: ReturnType<typeof fakeDb>;
beforeEach(() => {
  fake = fakeDb();
});

describe("createOrUpdateAdmin -- akun baru", () => {
  it("membuat OWNER dengan email baku (trim + huruf kecil) dan hash argon2id yang cocok dengan kata sandi", async () => {
    const result = await createOrUpdateAdmin(fake.prisma, { email: "  Admin@Contoh.ID ", password: "Rahasia123" });

    expect(result).toEqual({ action: "created", email: "admin@contoh.id", institution: "unchanged" });
    const data = fake.db.adminUser.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ email: "admin@contoh.id", name: "Admin", role: "OWNER" });
    expect(data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(data.passwordHash, "Rahasia123")).toBe(true);
    expect(JSON.stringify(fake.db.adminUser.create.mock.calls)).not.toContain("Rahasia123"); // kata sandi mentah tak pernah disimpan
  });

  it("memakai nama yang diberikan (terpangkas)", async () => {
    await createOrUpdateAdmin(fake.prisma, { ...VALID, name: "  Bu Guru  " });

    expect(fake.db.adminUser.create.mock.calls[0]![0].data.name).toBe("Bu Guru");
  });

  it("tidak menyentuh sesi/refresh token untuk akun baru", async () => {
    await createOrUpdateAdmin(fake.prisma, VALID);

    expect(fake.db.adminRefreshToken.updateMany).not.toHaveBeenCalled();
    expect(fake.db.$transaction).not.toHaveBeenCalled();
  });
});

describe("createOrUpdateAdmin -- akun sudah ada (pemulihan kata sandi)", () => {
  beforeEach(() => {
    fake = fakeDb(EXISTING);
  });

  it("mengganti hash, mengaktifkan kembali akun, dan MENCABUT semua refresh token yang masih hidup -- dalam satu transaksi", async () => {
    const result = await createOrUpdateAdmin(fake.prisma, { email: "ADMIN@contoh.id", password: "BaruSekali99" });

    expect(result.action).toBe("updated");
    expect(fake.db.adminUser.create).not.toHaveBeenCalled();
    const update = fake.db.adminUser.update.mock.calls[0]![0];
    expect(update.where).toEqual({ id: "adm1" });
    expect(update.data.isActive).toBe(true);
    expect(await argon2.verify(update.data.passwordHash, "BaruSekali99")).toBe(true);
    expect(fake.db.adminRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { adminUserId: "adm1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(fake.db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("tidak mengubah peran maupun nama bila nama tidak diberikan; mengubah nama bila diberikan", async () => {
    await createOrUpdateAdmin(fake.prisma, VALID);
    const withoutName = fake.db.adminUser.update.mock.calls[0]![0].data;
    expect(withoutName).not.toHaveProperty("role");
    expect(withoutName).not.toHaveProperty("name");

    await createOrUpdateAdmin(fake.prisma, { ...VALID, name: "Nama Baru" });
    expect(fake.db.adminUser.update.mock.calls[1]![0].data.name).toBe("Nama Baru");
  });
});

describe("createOrUpdateAdmin -- lembaga", () => {
  it("nama lembaga diberikan: baris tunggal di-upsert (terpangkas)", async () => {
    const result = await createOrUpdateAdmin(fake.prisma, { ...VALID, institutionName: "  Sakura Gakuin  " });

    expect(result.institution).toBe("set");
    expect(fake.db.institution.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton", name: "Sakura Gakuin" },
      update: { name: "Sakura Gakuin" },
    });
  });

  it.each([[undefined], [""], ["   "]])("nama lembaga %j: baris lembaga TIDAK disentuh", async (institutionName) => {
    const result = await createOrUpdateAdmin(fake.prisma, { ...VALID, institutionName });

    expect(result.institution).toBe("unchanged");
    expect(fake.db.institution.upsert).not.toHaveBeenCalled();
  });
});

describe("createOrUpdateAdmin -- masukan tidak valid (tidak ada satu pun operasi database)", () => {
  it.each([[""], ["   "], ["bukan-email"], ["a@"], ["@contoh.id"]])("email %j ditolak", async (email) => {
    await expect(createOrUpdateAdmin(fake.prisma, { ...VALID, email })).rejects.toThrow(/ADMIN_EMAIL/);

    expect(fake.db.adminUser.findUnique).not.toHaveBeenCalled();
    expect(fake.db.adminUser.create).not.toHaveBeenCalled();
  });

  it.each([
    ["kosong", ""],
    ["terlalu pendek", "Ab1"],
    ["tanpa angka", "HanyaHurufSaja"],
    ["tanpa huruf", "1234567890"],
  ])("kata sandi %s ditolak dengan aturan yang sama seperti pendaftaran murid", async (_label, password) => {
    await expect(createOrUpdateAdmin(fake.prisma, { ...VALID, password })).rejects.toThrow(AdminBootstrapError);
    await expect(createOrUpdateAdmin(fake.prisma, { ...VALID, password })).rejects.toThrow(/ADMIN_PASSWORD/);

    expect(fake.db.adminUser.create).not.toHaveBeenCalled();
    expect(fake.db.adminUser.update).not.toHaveBeenCalled();
  });

  it("nama terlalu panjang ditolak", async () => {
    await expect(createOrUpdateAdmin(fake.prisma, { ...VALID, name: "x".repeat(101) })).rejects.toThrow(/ADMIN_NAME/);
  });

  it("pesan galat tidak pernah memuat kata sandi yang diberikan", async () => {
    const error = await createOrUpdateAdmin(fake.prisma, { ...VALID, password: "pendek1" }).catch((e: Error) => e);

    expect((error as Error).message).not.toContain("pendek1");
  });
});
