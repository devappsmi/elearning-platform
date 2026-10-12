// Bentuk respons GET /tutor/quota (dan bagian dari respons /tutor/reply).
export class TutorQuotaDto {
  /** Jatah balasan AI per hari (env TUTOR_DAILY_QUOTA). */
  limit!: number;
  used!: number;
  remaining!: number;
  /** Tengah malam lokal server berikutnya -- kapan jatah di-reset. */
  resetsAt!: Date;
}
