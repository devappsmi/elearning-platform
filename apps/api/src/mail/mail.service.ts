import { Injectable, Logger } from "@nestjs/common";

/** Provider transaksional (SendGrid/Mailgun/SES) belum diputuskan -- lihat
 * "Yang Masih Perlu Dikonfirmasi" di plan fondasi. Untuk sekarang cuma log
 * ke console supaya alur invitation/reset-password bisa dites end-to-end
 * secara struktural (token/link yang benar terbentuk) tanpa perlu
 * kredensial provider sungguhan dulu. Ganti isi method ini begitu provider
 * dipilih -- signature-nya sudah final, tidak perlu ubah pemanggil. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendInvitation(params: { to: string; name: string; className: string; inviteUrl: string }): Promise<void> {
    this.logger.log(`[STUB] Undangan ke ${params.to} (${params.name}, kelas ${params.className}): ${params.inviteUrl}`);
  }

  async sendPasswordReset(params: { to: string; resetUrl: string }): Promise<void> {
    this.logger.log(`[STUB] Reset password ke ${params.to}: ${params.resetUrl}`);
  }

  async sendInvitationResendRequest(params: { adminEmails: string[]; requesterEmail: string }): Promise<void> {
    this.logger.log(
      `[STUB] Permintaan undangan ulang dari ${params.requesterEmail} -- notifikasi ke: ${params.adminEmails.join(", ")}`,
    );
  }
}
