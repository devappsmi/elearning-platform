import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";
import type { UpdateMeDto } from "./dto/update-me.dto";

// Regresi mass assignment (docs/PLAN.md bagian 6e): dulu `data: dto` meneruskan
// body mentah ke Prisma, jadi murid bisa menulis kolom apa pun di baris
// `User`-nya sendiri lewat PATCH /me (dibuktikan sungguhan: pindah kelas,
// ganti email tanpa verifikasi). Tes ini mensimulasikan skenario TERBURUK --
// ValidationPipe hilang, body mentah sampai ke service -- dan memastikan
// service sendiri tetap hanya menulis tiga field yang memang boleh.

function fakePrisma() {
  const update = vi.fn().mockResolvedValue({});
  const findUnique = vi.fn().mockResolvedValue({ id: "u1", name: "Budi", dailyXpGoal: 30, class: { name: "Kelas Hiragana Pagi" } });
  return { prisma: { user: { update, findUnique } } as unknown as PrismaService, update, findUnique };
}

describe("UsersService.update", () => {
  it("menulis hanya name, avatarUrl, dailyXpGoal", async () => {
    const { prisma, update } = fakePrisma();

    await new UsersService(prisma).update("u1", { name: "Budi", avatarUrl: "https://example.com/a.png", dailyXpGoal: 30 });

    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { name: "Budi", avatarUrl: "https://example.com/a.png", dailyXpGoal: 30 },
    });
  });

  it("field di luar tiga itu TIDAK ikut ditulis walau ada di objek yang diterima (pipe hilang)", async () => {
    const { prisma, update } = fakePrisma();
    const rawBody = {
      name: "Budi",
      classId: "kelas-lain",
      email: "penyerang@example.com",
      status: "ACTIVE",
      passwordHash: "$argon2id$buatan-sendiri",
      lastActiveAt: "2001-01-01T00:00:00.000Z",
    };

    await new UsersService(prisma).update("u1", rawBody as unknown as UpdateMeDto);

    const { data } = update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(Object.keys(data).filter((key) => data[key] !== undefined)).toEqual(["name"]);
    for (const forbidden of ["classId", "email", "status", "passwordHash", "lastActiveAt"]) {
      expect(data, `${forbidden} bocor ke Prisma`).not.toHaveProperty(forbidden);
    }
  });

  it("selalu menargetkan baris milik user yang login, bukan id dari body", async () => {
    const { prisma, update } = fakePrisma();

    await new UsersService(prisma).update("u1", { id: "u2", name: "Budi" } as unknown as UpdateMeDto);

    expect(update.mock.calls[0]![0]).toMatchObject({ where: { id: "u1" } });
    expect((update.mock.calls[0]![0] as { data: Record<string, unknown> }).data).not.toHaveProperty("id");
  });

  it("mengembalikan profil terbaru dari findUnique", async () => {
    const { prisma } = fakePrisma();

    const result = await new UsersService(prisma).update("u1", { name: "Budi" });

    expect(result).toMatchObject({ id: "u1", name: "Budi" });
  });
});

describe("UsersService.findByIdOrThrow", () => {
  it("meratakan relasi kelas jadi `className` (AC AUTH-04) dan tidak membawa objek `class` mentah", async () => {
    const { prisma } = fakePrisma();

    const me = await new UsersService(prisma).findByIdOrThrow("u1");

    expect(me).toMatchObject({ id: "u1", className: "Kelas Hiragana Pagi" });
    expect(me).not.toHaveProperty("class");
  });

  it("tidak pernah memilih passwordHash", async () => {
    const { prisma, findUnique } = fakePrisma();

    await new UsersService(prisma).findByIdOrThrow("u1");

    const select = findUnique.mock.calls[0]![0].select as Record<string, unknown>;
    expect(select).not.toHaveProperty("passwordHash");
    expect(select).toHaveProperty("class");
  });

  it("user tidak ada -> 404", async () => {
    const { prisma, findUnique } = fakePrisma();
    findUnique.mockResolvedValue(null);

    await expect(new UsersService(prisma).findByIdOrThrow("hilang")).rejects.toThrow("User tidak ditemukan");
  });
});
