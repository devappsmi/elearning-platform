import { describe, expect, it, vi } from "vitest";
import { HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
import type { AdminClassesService } from "../admin-classes/admin-classes.service";
import type { AuthService, PasswordResetOutcome } from "../auth/auth.service";
import type { GamificationService } from "../gamification/gamification.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminStudentsService } from "./admin-students.service";

// Reset password yang dipicu ADMIN (ADM-22) memakai jalur yang sama dengan lupa-password murid, jadi ikut
// kena batas per-email. Endpoint publik sengaja diam saat kena batas (anti-enumerasi); admin sudah
// terautentikasi dan barisnya pasti ada, jadi harus dijawab JUJUR (docs/PLAN.md bagian 6f).

function setup(outcome: PasswordResetOutcome, exists = true) {
  const prisma = { user: { findUnique: vi.fn(async () => (exists ? { id: "murid-1", email: "budi@example.com" } : null)) } };
  const auth = { requestPasswordReset: vi.fn(async () => outcome) };
  const service = new AdminStudentsService(
    prisma as unknown as PrismaService,
    auth as unknown as AuthService,
    {} as AdminClassesService,
    {} as GamificationService,
  );
  return { service, auth };
}

describe("AdminStudentsService.triggerPasswordReset", () => {
  it("terkirim: selesai tanpa galat, memakai email milik murid itu", async () => {
    const { service, auth } = setup("SENT");

    await expect(service.triggerPasswordReset("murid-1")).resolves.toBeUndefined();

    expect(auth.requestPasswordReset).toHaveBeenCalledWith("budi@example.com");
  });

  it("kena batas per-email: 429 dengan pesan Indonesia yang menyebut batasnya (bukan sukses palsu)", async () => {
    const { service } = setup("THROTTLED");

    const attempt = service.triggerPasswordReset("murid-1");

    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await expect(attempt).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    await expect(attempt).rejects.toThrow("maksimal 3 kali per jam");
  });

  it("murid tidak ada: 404 dan tidak ada permintaan reset sama sekali", async () => {
    const { service, auth } = setup("SENT", false);

    await expect(service.triggerPasswordReset("tidak-ada")).rejects.toBeInstanceOf(NotFoundException);
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
  });
});
