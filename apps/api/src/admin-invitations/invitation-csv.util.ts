import { parse } from "csv-parse/sync";

export interface InvitationCsvRow {
  /** Nomor baris SEPERTI YANG DILIHAT ADMIN DI EXCEL (baris 1 = header, data
   * mulai baris 2) -- dipakai di laporan hasil bulk invite supaya admin bisa
   * langsung cocokkan ke file aslinya. */
  rowNumber: number;
  name: string;
  email: string;
  className: string;
}

/** ADM-11: parse CSV kolom nama/email/kelas. Pakai `csv-parse` (bukan split
 * koma manual) -- CSV hasil export Excel sungguhan sering punya field
 * ber-quote/koma-di-dalam-quote/BOM, split manual gampang salah diam-diam. */
export function parseInvitationCsv(buffer: Buffer): InvitationCsvRow[] {
  let records: Record<string, string>[];
  try {
    records = parse(buffer, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err) {
    throw new Error(`CSV tidak bisa dibaca: ${err instanceof Error ? err.message : String(err)}`);
  }

  return records.map((r, i) => ({
    rowNumber: i + 2,
    name: r.nama ?? "",
    email: r.email ?? "",
    className: r.kelas ?? "",
  }));
}
