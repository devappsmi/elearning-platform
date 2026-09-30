import type { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentBootstrapError, createOrUpdateStudent } from "./student-bootstrap";

interface StoredClass {
  id: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
}
interface StoredStudent {
  id: string;
  email: string;
  classId: string;
  class: { name: string };
}

const ACTIVE = (id: string, name: string): StoredClass => ({ id, name, status: "ACTIVE" });

function fakeDb(options: { student?: StoredStudent | null; classes?: StoredClass[]; pendingInvitation?: boolean } = {}) {
  const classes = options.classes ?? [];
  const tx = {
    user: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { email: string } }) => Promise.resolve(options.student && options.student.email === where.email ? options.student : null)),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    class: {
      findMany: vi.fn().mockImplementation(({ where }: { where: { status?: string; name?: { equals: string; mode?: string } } }) => {
        if (where.status) return Promise.resolve(classes.filter((c) => c.status === where.status));
        // Seperti Postgres: tanpa `mode: "insensitive"` pencocokan nama membedakan huruf besar/kecil.
        const { equals, mode } = where.name!;
        return Promise.resolve(classes.filter((c) => (mode === "insensitive" ? c.name.toLowerCase() === equals.toLowerCase() : c.name === equals)));
      }),
      create: vi.fn().mockImplementation(({ data }: { data: { name: string } }) => Promise.resolve({ id: "kelas-baru", name: data.name })),
    },
    invitation: { findFirst: vi.fn().mockResolvedValue(options.pendingInvitation ? { id: "inv1" } : null) },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
  const db = { $transaction: vi.fn().mockImplementation((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { tx, db, prisma: db as any as PrismaClient };
}

/** Semua tulisan ke database (bukan pembacaan) pada satu tes. */
function writes(tx: ReturnType<typeof fakeDb>["tx"]) {
  return tx.user.create.mock.calls.length + tx.user.update.mock.calls.length + tx.class.create.mock.calls.length + tx.refreshToken.updateMany.mock.calls.length;
}

const VALID = { email: "murid@contoh.id", password: "Rahasia123" };
const KELAS_PAGI = ACTIVE("k1", "Kelas Pagi");
const EXISTING: StoredStudent = { id: "u1", email: "murid@contoh.id", classId: "k1", class: { name: "Kelas Pagi" } };

let fake: ReturnType<typeof fakeDb>;
beforeEach(() => {
  fake = fakeDb({ classes: [KELAS_PAGI] });
});

describe("createOrUpdateStudent -- murid baru", () => {
  it("membuat murid di satu-satunya kelas aktif: email baku, nama bawaan, hash argon2id yang cocok; kata sandi mentah tak pernah disimpan", async () => {
    const result = await createOrUpdateStudent(fake.prisma, { email: "  Murid@Contoh.ID ", password: "Rahasia123" });

    expect(result).toEqual({ action: "created", email: "murid@contoh.id", className: "Kelas Pagi", classCreated: false });
    const data = fake.tx.user.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ classId: "k1", email: "murid@contoh.id", name: "Murid Uji" });
    expect(data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(data.passwordHash, "Rahasia123")).toBe(true);
    expect(JSON.stringify(fake.tx.user.create.mock.calls)).not.toContain("Rahasia123");
    expect(fake.tx.class.create).not.toHaveBeenCalled();
  });

  it("memakai nama yang diberikan (terpangkas)", async () => {
    await createOrUpdateStudent(fake.prisma, { ...VALID, name: "  Budi Santoso  " });

    expect(fake.tx.user.create.mock.calls[0]![0].data.name).toBe("Budi Santoso");
  });

  it("tidak menyentuh sesi/refresh token untuk murid baru", async () => {
    await createOrUpdateStudent(fake.prisma, VALID);

    expect(fake.tx.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("semuanya berjalan dalam SATU transaksi", async () => {
    await createOrUpdateStudent(fake.prisma, VALID);

    expect(fake.db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("createOrUpdateStudent -- pemilihan kelas untuk murid baru", () => {
  it("belum ada kelas sama sekali: 'Kelas Uji' dibuat DULU, baru muridnya", async () => {
    fake = fakeDb({ classes: [] });

    const result = await createOrUpdateStudent(fake.prisma, VALID);

    expect(result).toMatchObject({ className: "Kelas Uji", classCreated: true });
    expect(fake.tx.class.create).toHaveBeenCalledWith({ data: { name: "Kelas Uji" }, select: { id: true, name: true } });
    expect(fake.tx.user.create.mock.calls[0]![0].data.classId).toBe("kelas-baru");
    expect(fake.tx.class.create.mock.invocationCallOrder[0]!).toBeLessThan(fake.tx.user.create.mock.invocationCallOrder[0]!);
  });

  it("kelas ARSIP tidak dihitung: satu kelas aktif + satu arsip -> kelas aktif itu dipakai", async () => {
    fake = fakeDb({ classes: [{ id: "k0", name: "Kelas Lama", status: "ARCHIVED" }, KELAS_PAGI] });

    const result = await createOrUpdateStudent(fake.prisma, VALID);

    expect(result.className).toBe("Kelas Pagi");
    expect(fake.tx.class.create).not.toHaveBeenCalled();
  });

  it("beberapa kelas aktif dan CLASS_NAME kosong: ditolak dengan daftar nama -- tidak menebak, tidak ada yang ditulis", async () => {
    fake = fakeDb({ classes: [KELAS_PAGI, ACTIVE("k2", "Kelas Sore")] });

    const error = await createOrUpdateStudent(fake.prisma, VALID).catch((e: Error) => e);

    expect(error).toBeInstanceOf(StudentBootstrapError);
    expect((error as Error).message).toMatch(/2 kelas aktif/);
    expect((error as Error).message).toContain('"Kelas Pagi", "Kelas Sore"');
    expect((error as Error).message).toContain("CLASS_NAME");
    expect(writes(fake.tx)).toBe(0);
    // Urutan daftar deterministik (yang tertua dulu); Postgres tanpa ORDER BY tidak menjamin urutan apa pun.
    expect(fake.tx.class.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } }));
  });

  it("daftar nama pada galat dipotong di 10 dan menyebut sisanya", async () => {
    fake = fakeDb({ classes: Array.from({ length: 12 }, (_, i) => ACTIVE(`k${i}`, `Kelas ${i + 1}`)) });

    const error = (await createOrUpdateStudent(fake.prisma, VALID).catch((e: Error) => e)) as Error;

    expect(error.message).toContain('"Kelas 10"');
    expect(error.message).not.toContain('"Kelas 11"');
    expect(error.message).toContain("dan 2 lainnya");
  });

  it("CLASS_NAME cocok tanpa membedakan huruf besar/kecil: kelas itu dipakai, tidak membuat kelas baru", async () => {
    fake = fakeDb({ classes: [KELAS_PAGI, ACTIVE("k2", "Kelas Sore")] });

    const result = await createOrUpdateStudent(fake.prisma, { ...VALID, className: "  kelas SORE " });

    expect(result).toMatchObject({ className: "Kelas Sore", classCreated: false });
    expect(fake.tx.user.create.mock.calls[0]![0].data.classId).toBe("k2");
    expect(fake.tx.class.create).not.toHaveBeenCalled();
  });

  it("CLASS_NAME yang belum ada: kelasnya dibuat dengan nama itu (terpangkas), lalu muridnya", async () => {
    const result = await createOrUpdateStudent(fake.prisma, { ...VALID, className: "  Kelas Uji Coba " });

    expect(result).toMatchObject({ className: "Kelas Uji Coba", classCreated: true });
    expect(fake.tx.class.create).toHaveBeenCalledWith({ data: { name: "Kelas Uji Coba" }, select: { id: true, name: true } });
    expect(fake.tx.class.create.mock.invocationCallOrder[0]!).toBeLessThan(fake.tx.user.create.mock.invocationCallOrder[0]!);
  });

  it("CLASS_NAME hanya ada sebagai kelas ARSIP: ditolak (kelas arsip tidak menerima murid baru), tidak ada yang ditulis", async () => {
    fake = fakeDb({ classes: [{ id: "k0", name: "Kelas Lama", status: "ARCHIVED" }] });

    const error = (await createOrUpdateStudent(fake.prisma, { ...VALID, className: "kelas lama" }).catch((e: Error) => e)) as Error;

    expect(error).toBeInstanceOf(StudentBootstrapError);
    expect(error.message).toMatch(/diarsipkan/);
    expect(writes(fake.tx)).toBe(0);
  });

  it("CLASS_NAME cocok dengan DUA kelas aktif: ditolak sebagai ambigu", async () => {
    fake = fakeDb({ classes: [ACTIVE("k1", "Kelas A"), ACTIVE("k2", "kelas a")] });

    const error = (await createOrUpdateStudent(fake.prisma, { ...VALID, className: "Kelas A" }).catch((e: Error) => e)) as Error;

    expect(error.message).toMatch(/2 kelas aktif bernama/);
    expect(writes(fake.tx)).toBe(0);
  });

  it("kelas ARSIP + kelas AKTIF bernama sama: yang aktif dipakai", async () => {
    fake = fakeDb({ classes: [{ id: "k0", name: "Kelas Pagi", status: "ARCHIVED" }, KELAS_PAGI] });

    const result = await createOrUpdateStudent(fake.prisma, { ...VALID, className: "Kelas Pagi" });

    expect(fake.tx.user.create.mock.calls[0]![0].data.classId).toBe("k1");
    expect(result.classCreated).toBe(false);
  });
});

describe("createOrUpdateStudent -- undangan yang masih PENDING", () => {
  it("email murid BARU dengan undangan PENDING yang belum kedaluwarsa: ditolak dengan petunjuk, tidak ada yang ditulis", async () => {
    fake = fakeDb({ classes: [KELAS_PAGI], pendingInvitation: true });

    const error = (await createOrUpdateStudent(fake.prisma, VALID).catch((e: Error) => e)) as Error;

    expect(error).toBeInstanceOf(StudentBootstrapError);
    expect(error.message).toContain("murid@contoh.id");
    expect(error.message).toMatch(/PENDING/);
    expect(writes(fake.tx)).toBe(0);
    expect(fake.tx.invitation.findFirst).toHaveBeenCalledWith({
      where: { email: "murid@contoh.id", status: "PENDING", expiresAt: { gt: expect.any(Date) } },
      select: { id: true },
    });
  });

  it("undangan hanya diperiksa untuk murid BARU: murid yang sudah ada tidak terhalang", async () => {
    fake = fakeDb({ classes: [KELAS_PAGI], student: EXISTING, pendingInvitation: true });

    const result = await createOrUpdateStudent(fake.prisma, VALID);

    expect(result.action).toBe("updated");
    expect(fake.tx.invitation.findFirst).not.toHaveBeenCalled();
  });
});

describe("createOrUpdateStudent -- murid sudah ada (pemulihan kata sandi murid uji)", () => {
  beforeEach(() => {
    fake = fakeDb({ classes: [KELAS_PAGI], student: EXISTING });
  });

  it("mengganti hash, mengaktifkan kembali akun, dan MENCABUT semua refresh token yang masih hidup -- dalam satu transaksi", async () => {
    const result = await createOrUpdateStudent(fake.prisma, { email: "MURID@contoh.id", password: "BaruSekali99" });

    expect(result).toEqual({ action: "updated", email: "murid@contoh.id", className: "Kelas Pagi", classCreated: false });
    expect(fake.tx.user.create).not.toHaveBeenCalled();
    const update = fake.tx.user.update.mock.calls[0]![0];
    expect(update.where).toEqual({ id: "u1" });
    expect(update.data.status).toBe("ACTIVE");
    expect(await argon2.verify(update.data.passwordHash, "BaruSekali99")).toBe(true);
    expect(fake.tx.refreshToken.updateMany).toHaveBeenCalledWith({ where: { userId: "u1", revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(fake.db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("tanpa nama dan tanpa CLASS_NAME: nama dan kelas TIDAK diubah, dan kelas tidak diperiksa sama sekali (walau kelas aktif ada banyak)", async () => {
    fake = fakeDb({ classes: [KELAS_PAGI, ACTIVE("k2", "Kelas Sore"), ACTIVE("k3", "Kelas Malam")], student: EXISTING });

    await createOrUpdateStudent(fake.prisma, VALID);

    const data = fake.tx.user.update.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty("name");
    expect(data).not.toHaveProperty("classId");
    expect(fake.tx.class.findMany).not.toHaveBeenCalled();
    expect(fake.tx.class.create).not.toHaveBeenCalled();
  });

  it("nama diberikan: nama diubah (terpangkas)", async () => {
    await createOrUpdateStudent(fake.prisma, { ...VALID, name: "  Nama Baru " });

    expect(fake.tx.user.update.mock.calls[0]![0].data.name).toBe("Nama Baru");
  });

  it("CLASS_NAME diberikan: murid dipindahkan ke kelas itu, dan hasilnya menyebut kelas baru", async () => {
    fake = fakeDb({ classes: [KELAS_PAGI, ACTIVE("k2", "Kelas Sore")], student: EXISTING });

    const result = await createOrUpdateStudent(fake.prisma, { ...VALID, className: "Kelas Sore" });

    expect(fake.tx.user.update.mock.calls[0]![0].data.classId).toBe("k2");
    expect(result.className).toBe("Kelas Sore");
  });

  it("CLASS_NAME hanya ada sebagai kelas ARSIP: ditolak, akun tidak berubah dan sesi tidak dicabut", async () => {
    fake = fakeDb({ classes: [{ id: "k0", name: "Kelas Lama", status: "ARCHIVED" }], student: EXISTING });

    await expect(createOrUpdateStudent(fake.prisma, { ...VALID, className: "Kelas Lama" })).rejects.toThrow(/diarsipkan/);

    expect(writes(fake.tx)).toBe(0);
  });
});

describe("createOrUpdateStudent -- masukan tidak valid (tidak ada satu pun operasi database)", () => {
  it.each([[""], ["   "], ["bukan-email"], ["a@"], ["@contoh.id"]])("email %j ditolak", async (email) => {
    await expect(createOrUpdateStudent(fake.prisma, { ...VALID, email })).rejects.toThrow(/STUDENT_EMAIL/);

    expect(fake.db.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["kosong", ""],
    ["terlalu pendek", "Ab1"],
    ["tanpa angka", "HanyaHurufSaja"],
    ["tanpa huruf", "1234567890"],
  ])("kata sandi %s ditolak dengan aturan yang sama seperti pendaftaran murid", async (_label, password) => {
    await expect(createOrUpdateStudent(fake.prisma, { ...VALID, password })).rejects.toThrow(StudentBootstrapError);
    await expect(createOrUpdateStudent(fake.prisma, { ...VALID, password })).rejects.toThrow(/STUDENT_PASSWORD/);

    expect(fake.db.$transaction).not.toHaveBeenCalled();
  });

  it("nama dan nama kelas yang terlalu panjang (101) ditolak, tepat 100 karakter diterima", async () => {
    await expect(createOrUpdateStudent(fake.prisma, { ...VALID, name: "x".repeat(101) })).rejects.toThrow(/STUDENT_NAME/);
    await expect(createOrUpdateStudent(fake.prisma, { ...VALID, className: "x".repeat(101) })).rejects.toThrow(/CLASS_NAME/);
    expect(fake.db.$transaction).not.toHaveBeenCalled();

    await expect(createOrUpdateStudent(fake.prisma, { ...VALID, name: "x".repeat(100), className: "y".repeat(100) })).resolves.toMatchObject({ action: "created" });
  });

  it("pesan galat tidak pernah memuat kata sandi yang diberikan", async () => {
    const error = await createOrUpdateStudent(fake.prisma, { ...VALID, password: "pendek1" }).catch((e: Error) => e);

    expect((error as Error).message).not.toContain("pendek1");
  });
});
