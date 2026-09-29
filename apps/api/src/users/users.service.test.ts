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
  const findUnique = vi.fn().mockResolvedValue({ id: "u1", name: "Budi", dailyXpGoal: 30 });
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
