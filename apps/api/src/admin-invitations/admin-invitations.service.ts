import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmail } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { AdminClassesService } from "../admin-classes/admin-classes.service";
import { generateOpaqueToken } from "../common/opaque-token.util";
import { addDuration } from "../common/duration.util";
import { normalizeEmail } from "../common/email.util";
import type { Env } from "../config/env.validation";
import { parseInvitationCsv } from "./invitation-csv.util";
import type { ListInvitationsQueryDto } from "./dto/invitation.dto";
import type { InvitationDto, InvitationListItemDto } from "./dto/invitation-view.dto";

const INVITATION_TTL = "7d"; // AUTH-01 AC: masa berlaku 7 hari

// Field publik Invitation -- SENGAJA tanpa `tokenHash` (bukan bagian API
// publik sama sekali, cuma dipakai internal untuk memvalidasi token mentah
// dari link email di AuthService.register). Dipakai sebagai `select` di
// SETIAP query invitation di bawah -- sebelumnya beberapa jalur (create,
// resend, revoke) tidak pakai `select`/`include` eksplisit sama sekali,
// yang berarti Prisma balikin SEMUA field skalar termasuk tokenHash secara
// default; ketahuan pas menulis DTO respons ini, diperbaiki sekalian (lihat
// catatan lengkap kenapa ini bukan celah eksploitasi praktis di
// dto/invitation-view.dto.ts).
const INVITATION_SELECT = {
  id: true,
  classId: true,
  name: true,
  email: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

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

  async createSingle(dto: { name: string; email: string; classId: string }): Promise<InvitationDto> {
    // Email disimpan dan dicocokkan dalam huruf kecil (common/email.util.ts) -- tanpa itu
    // "Budi@X.com" dan "budi@X.com" lolos sebagai dua undangan/akun berbeda.
    const email = normalizeEmail(dto.email);
    const klass = await this.classes.assertActiveClass(dto.classId);
    await this.assertEmailInvitable(email);
    return this.createInvitationRow(dto.name, email, klass.id, klass.name);
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

  private async createInvitationRow(name: string, email: string, classId: string, className: string): Promise<InvitationDto> {
    const { token, tokenHash } = generateOpaqueToken();
    const invitation = await this.prisma.invitation.create({
      data: { classId, name, email, tokenHash, expiresAt: addDuration(new Date(), INVITATION_TTL) },
      select: INVITATION_SELECT,
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

        const email = normalizeEmail(row.email);
        if (seenInThisFile.has(email)) throw new Error("Duplikat di dalam file CSV ini");
        seenInThisFile.add(email);

        const klass = classByName.get(row.className.trim().toLowerCase());
        if (!klass) throw new Error(`Kelas tidak ditemukan: '${row.className}'`);
        if (klass.status === "ARCHIVED") throw new Error(`Kelas '${row.className}' sudah diarsipkan`);

        await this.assertEmailInvitable(email);
        await this.createInvitationRow(row.name, email, klass.id, klass.name);
        results.push({ row: row.rowNumber, email, status: "sent" });
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

  async list(query: ListInvitationsQueryDto): Promise<InvitationListItemDto[]> {
    return this.prisma.invitation.findMany({
      where: { status: query.status, classId: query.classId },
      select: { ...INVITATION_SELECT, class: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** PENDING (belum kedaluwarsa) atau EXPIRED bisa dikirim ulang (token+masa
   * berlaku diperbarui, status EXPIRED kembali jadi PENDING). ACCEPTED
   * (sudah dipakai) dan REVOKED (sengaja dicabut admin) sengaja ditolak --
   * lihat komentar masing-masing di bawah. */
  async resend(id: string): Promise<InvitationDto> {
    const invitation = await this.prisma.invitation.findUnique({ where: { id }, include: { class: { select: { name: true } } } });
    if (!invitation) throw new NotFoundException(`Undangan tidak ditemukan: ${id}`);
    if (invitation.status === "ACCEPTED") throw new BadRequestException("Undangan sudah dipakai untuk registrasi, tidak bisa dikirim ulang");
    if (invitation.status === "REVOKED") throw new BadRequestException("Undangan sudah dicabut -- buat undangan baru kalau murid ini perlu diundang lagi");

    const { token, tokenHash } = generateOpaqueToken();
    const updated = await this.prisma.invitation.update({
      where: { id },
      data: { tokenHash, expiresAt: addDuration(new Date(), INVITATION_TTL), status: "PENDING" },
      select: INVITATION_SELECT,
    });
    await this.sendInvitationEmail({ email: invitation.email, name: invitation.name, className: invitation.class.name }, token);
    return updated;
  }

  async revoke(id: string): Promise<InvitationDto> {
    const invitation = await this.prisma.invitation.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!invitation) throw new NotFoundException(`Undangan tidak ditemukan: ${id}`);
    if (invitation.status === "ACCEPTED") throw new BadRequestException("Undangan yang sudah dipakai untuk registrasi tidak bisa dicabut");

    return this.prisma.invitation.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() }, select: INVITATION_SELECT });
  }
}
