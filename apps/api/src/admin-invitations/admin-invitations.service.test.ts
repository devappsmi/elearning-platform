import { describe, expect, it, vi } from "vitest";
import { ConflictException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { AdminClassesService } from "../admin-classes/admin-classes.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminInvitationsService } from "./admin-invitations.service";

// Undangan menyimpan email BAKU (huruf kecil) dan menolak "dua alamat" yang hanya beda ejaan
// (docs/PLAN.md bagian 6f). Prisma dan email ditiru di memori: yang diuji adalah alamat yang
// DICARI, DISIMPAN, dan DIKIRIMI email.

interface InvitationRow {
  email: string;
  status: "PENDING";
}

function setup(existingUsers: string[] = [], pending: string[] = []) {
  const invitations: InvitationRow[] = pending.map((email) => ({ email, status: "PENDING" }));
  const created: Array<{ name: string; email: string; classId: string }> = [];
  const prisma = {
    class: { findMany: vi.fn(async () => [{ id: "kelas-1", name: "Kelas Hiragana", status: "ACTIVE" }]) },
    user: { findUnique: vi.fn(async ({ where }: { where: { email: string } }) => (existingUsers.includes(where.email) ? { id: "u1" } : null)) },
    invitation: {
      findFirst: vi.fn(async ({ where }: { where: { email: string; status: string } }) =>
        invitations.find((row) => row.email === where.email && row.status === where.status) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: { name: string; email: string; classId: string } }) => {
        invitations.push({ email: data.email, status: "PENDING" });
        created.push({ name: data.name, email: data.email, classId: data.classId });
        return { id: `inv-${created.length}`, ...data, status: "PENDING" };
      }),
    },
  };
  const mail = { sendInvitation: vi.fn(async () => {}) };
  const classes = { assertActiveClass: vi.fn(async () => ({ id: "kelas-1", name: "Kelas Hiragana" })) };
  const config = { get: () => "http://app.test" };
  const service = new AdminInvitationsService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
    classes as unknown as AdminClassesService,
    config as unknown as ConfigService<never, true>,
  );
  return { service, prisma, mail, created };
}

const csv = (rows: string[]) => Buffer.from(["nama,email,kelas", ...rows].join("\n"), "utf8");

describe("AdminInvitationsService.createSingle -- email dinormalkan", () => {
  it("menyimpan dan mengirim ke alamat baku (huruf kecil, tanpa spasi tepi)", async () => {
    const { service, prisma, mail, created } = setup();

    await service.createSingle({ name: "Budi", email: "  Budi.Santoso@Example.COM ", classId: "kelas-1" });

    expect(created[0]!.email).toBe("budi.santoso@example.com");
    expect(prisma.invitation.create.mock.calls[0]![0].data.email).toBe("budi.santoso@example.com");
    expect((mail.sendInvitation.mock.calls[0]![0] as { to: string }).to).toBe("budi.santoso@example.com");
  });

  it("pemeriksaan 'sudah jadi murid' dan 'sudah punya undangan aktif' memakai alamat baku", async () => {
    const { service, prisma } = setup();

    await service.createSingle({ name: "Budi", email: "BUDI@Example.com", classId: "kelas-1" });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "budi@example.com" }, select: { id: true } });
    expect(prisma.invitation.findFirst.mock.calls[0]![0].where).toEqual({ email: "budi@example.com", status: "PENDING" });
  });

  it("undangan kedua untuk alamat yang sama tetapi beda ejaan DITOLAK (409), tidak lolos sebagai orang lain", async () => {
    const { service, created } = setup();
    await service.createSingle({ name: "Budi", email: "budi@example.com", classId: "kelas-1" });

    const second = service.createSingle({ name: "Budi Lagi", email: "Budi@EXAMPLE.com", classId: "kelas-1" });

    await expect(second).rejects.toBeInstanceOf(ConflictException);
    await expect(second).rejects.toThrow("budi@example.com sudah punya undangan aktif");
    expect(created).toHaveLength(1);
  });

  it("alamat yang sudah jadi murid ditolak walau diketik dengan huruf besar", async () => {
    const { service, created } = setup(["sari@example.com"]);

    await expect(service.createSingle({ name: "Sari", email: "SARI@Example.com", classId: "kelas-1" })).rejects.toThrow(
      "sari@example.com sudah terdaftar sebagai murid",
    );
    expect(created).toHaveLength(0);
  });
});

describe("AdminInvitationsService.createBulk -- email dinormalkan", () => {
  it("menyimpan alamat baku dan melaporkan alamat baku", async () => {
    const { service, created } = setup();

    const report = await service.createBulk(csv(["Budi,Budi@Example.COM,Kelas Hiragana"]));

    expect(created.map((row) => row.email)).toEqual(["budi@example.com"]);
    expect(report.results).toEqual([{ row: 2, email: "budi@example.com", status: "sent" }]);
  });

  it("baris kembar yang hanya beda ejaan di DALAM file dilaporkan duplikat (bukan dua undangan)", async () => {
    const { service, created } = setup();

    const report = await service.createBulk(
      csv(["Budi,budi@example.com,Kelas Hiragana", "Budi Lagi,BUDI@Example.com,Kelas Hiragana", "Sari,sari@example.com,Kelas Hiragana"]),
    );

    expect(report.sent).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.results[1]).toMatchObject({ row: 3, status: "failed", reason: "Duplikat di dalam file CSV ini" });
    expect(created.map((row) => row.email)).toEqual(["budi@example.com", "sari@example.com"]);
  });

  it("baris untuk alamat yang sudah punya undangan aktif (beda ejaan) gagal dengan alasan yang jelas", async () => {
    const { service, created } = setup([], ["budi@example.com"]);

    const report = await service.createBulk(csv(["Budi,BUDI@example.com,Kelas Hiragana"]));

    expect(report.failed).toBe(1);
    expect(report.results[0]!.reason).toContain("sudah punya undangan aktif");
    expect(created).toHaveLength(0);
  });

  it("baris dengan email tidak valid tetap dilaporkan apa adanya", async () => {
    const { service } = setup();

    const report = await service.createBulk(csv(["Budi,bukan-email,Kelas Hiragana"]));

    expect(report.results[0]).toMatchObject({ status: "failed", email: "bukan-email" });
    expect(report.results[0]!.reason).toContain("Format email tidak valid");
  });
});
