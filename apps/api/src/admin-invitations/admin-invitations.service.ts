import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmail } from "class-validator";
import type { Invitation } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { AdminClassesService } from "../admin-classes/admin-classes.service";
import { generateOpaqueToken } from "../common/opaque-token.util";
import { addDuration } from "../common/duration.util";
import type { Env } from "../config/env.validation";
import { parseInvitationCsv } from "./invitation-csv.util";
import type { ListInvitationsQueryDto } from "./dto/invitation.dto";

const INVITATION_TTL = "7d"; // AUTH-01 AC: masa berlaku 7 hari

export interface BulkInviteRowResult {
  row: number;
  email: string;
  status: "sent" | "failed";
  reason?: string;
}

export interface BulkInviteReport {
  total: number;
  sent: number;
  failed: number;
  results: BulkInviteRowResult[];
}

/** ADM-10/11/12. Satu-satunya jalur pembuatan Invitation sekarang -- sebelum
 * modul ini, baris Invitation cuma bisa dibuat lewat script sekali-pakai
 * langsung ke Prisma (lihat riwayat verifikasi manual Milestone 5/7). */
@Injectable()
export class AdminInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly classes: AdminClassesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async createSingle(dto: { name: string; email: string; classId: string }): Promise<Invitation> {
    const klass = await this.classes.assertActiveClass(dto.classId);
    await this.assertEmailInvitable(dto.email);
    return this.createInvitationRow(dto.name, dto.email, klass.id, klass.name);
  }

  /** AUTH-01 AB "Satu email hanya bisa punya satu undangan aktif": ditolak di
   * sini (bukan diam-diam ditimpa) -- admin yang mau mengirim ulang harus
   * pakai `resend`, bukan bikin undangan baru. Juga menolak email yang SUDAH
   * jadi akun murid (AUTH-02 AB "satu email = satu akun"). */
  private async assertEmailInvitable(email: string): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) throw new ConflictException(`${email} sudah terdaftar sebagai murid`);

    const existingPending = await this.prisma.invitation.findFirst({ where: { email, status: "PENDING" }, select: { id: true } });
    if (existingPending) {
      throw new ConflictException(`${email} sudah punya undangan aktif -- gunakan "kirim ulang" pada undangan yang ada, bukan buat baru`);
    }
  }

  private async createInvitationRow(name: string, email: string, classId: string, className: string): Promise<Invitation> {
    const { token, tokenHash } = generateOpaqueToken();
    const invitation = await this.prisma.invitation.create({
      data: { classId, name, email, tokenHash, expiresAt: addDuration(new Date(), INVITATION_TTL) },
    });
    await this.sendInvitationEmail({ email, name, className }, token);
    return invitation;
  }

  private async sendInvitationEmail(params: { email: string; name: string; className: string }, token: string): Promise<void> {
    const inviteUrl = `${this.config.get("CORS_ORIGIN_STUDENT", { infer: true })}/invite/${token}`;
    await this.mail.sendInvitation({ to: params.email, name: params.name, className: params.className, inviteUrl });
  }

  /** ADM-11: setiap baris diproses independen -- satu baris gagal (email
   * tidak valid, kelas tidak ketemu, dobel) TIDAK menggagalkan baris lain,
   * sesuai AC "laporan hasil: X terkirim, Y gagal (dengan alasan per baris)". */
  async createBulk(csvBuffer: Buffer): Promise<BulkInviteReport> {
    const rows = parseInvitationCsv(csvBuffer);
    if (rows.length === 0) throw new BadRequestException("CSV kosong atau tidak punya baris data");

    const classes = await this.prisma.class.findMany({ select: { id: true, name: true, status: true } });
    const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c]));
    const seenInThisFile = new Set<string>();
    const results: BulkInviteRowResult[] = [];

    for (const row of rows) {
      try {
        if (!row.name) throw new Error("Kolom 'nama' kosong");
        if (!row.email) throw new Error("Kolom 'email' kosong");
        if (!row.className) throw new Error("Kolom 'kelas' kosong");
        if (!isEmail(row.email)) throw new Error(`Format email tidak valid: '${row.email}'`);

        const emailKey = row.email.trim().toLowerCase();
        if (seenInThisFile.has(emailKey)) throw new Error("Duplikat di dalam file CSV ini");
        seenInThisFile.add(emailKey);

        const klass = classByName.get(row.className.trim().toLowerCase());
        if (!klass) throw new Error(`Kelas tidak ditemukan: '${row.className}'`);
        if (klass.status === "ARCHIVED") throw new Error(`Kelas '${row.className}' sudah diarsipkan`);

        await this.assertEmailInvitable(row.email);
        await this.createInvitationRow(row.name, row.email, klass.id, klass.name);
        results.push({ row: row.rowNumber, email: row.email, status: "sent" });
      } catch (err) {
        results.push({ row: row.rowNumber, email: row.email || "(kosong)", status: "failed", reason: err instanceof Error ? err.message : String(err) });
      }
    }

    return {
      total: rows.length,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  }

  async list(query: ListInvitationsQueryDto) {
    return this.prisma.invitation.findMany({
      where: { status: query.status, classId: query.classId },
      include: { class: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** PENDING (belum kedaluwarsa) atau EXPIRED bisa dikirim ulang (token+masa
   * berlaku diperbarui, status EXPIRED kembali jadi PENDING). ACCEPTED
   * (sudah dipakai) dan REVOKED (sengaja dicabut admin) sengaja ditolak --
   * lihat komentar masing-masing di bawah. */
  async resend(id: string): Promise<Invitation> {
    const invitation = await this.prisma.invitation.findUnique({ where: { id }, include: { class: { select: { name: true } } } });
    if (!invitation) throw new NotFoundException(`Undangan tidak ditemukan: ${id}`);
    if (invitation.status === "ACCEPTED") throw new BadRequestException("Undangan sudah dipakai untuk registrasi, tidak bisa dikirim ulang");
    if (invitation.status === "REVOKED") throw new BadRequestException("Undangan sudah dicabut -- buat undangan baru kalau murid ini perlu diundang lagi");

    const { token, tokenHash } = generateOpaqueToken();
    const updated = await this.prisma.invitation.update({
      where: { id },
      data: { tokenHash, expiresAt: addDuration(new Date(), INVITATION_TTL), status: "PENDING" },
    });
    await this.sendInvitationEmail({ email: invitation.email, name: invitation.name, className: invitation.class.name }, token);
    return updated;
  }

  async revoke(id: string): Promise<Invitation> {
    const invitation = await this.prisma.invitation.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!invitation) throw new NotFoundException(`Undangan tidak ditemukan: ${id}`);
    if (invitation.status === "ACCEPTED") throw new BadRequestException("Undangan yang sudah dipakai untuk registrasi tidak bisa dicabut");

    return this.prisma.invitation.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() } });
  }
}
