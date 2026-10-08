import { describe, expect, it } from "vitest";
import { parseInvitationCsv } from "./invitation-csv.util";

describe("parseInvitationCsv", () => {
  it("parses well-formed rows, row numbers matching what admin sees in Excel", () => {
    const csv = "nama,email,kelas\nBudi Santoso,budi@example.com,Kelas A\nSiti Aminah,siti@example.com,Kelas B\n";
    const rows = parseInvitationCsv(Buffer.from(csv));
    expect(rows).toEqual([
      { rowNumber: 2, name: "Budi Santoso", email: "budi@example.com", className: "Kelas A" },
      { rowNumber: 3, name: "Siti Aminah", email: "siti@example.com", className: "Kelas B" },
    ]);
  });

  it("is case-insensitive on header names", () => {
    const csv = "Nama,Email,Kelas\nBudi,budi@example.com,Kelas A\n";
    const rows = parseInvitationCsv(Buffer.from(csv));
    expect(rows[0]).toMatchObject({ name: "Budi", email: "budi@example.com", className: "Kelas A" });
  });

  it("handles quoted fields containing commas", () => {
    const csv = 'nama,email,kelas\n"Santoso, Budi",budi@example.com,Kelas A\n';
    const rows = parseInvitationCsv(Buffer.from(csv));
    expect(rows[0]?.name).toBe("Santoso, Budi");
  });

  it("strips a UTF-8 BOM (common from Excel exports)", () => {
    const csv = "﻿nama,email,kelas\nBudi,budi@example.com,Kelas A\n";
    const rows = parseInvitationCsv(Buffer.from(csv));
    expect(rows[0]?.name).toBe("Budi");
  });

  it("skips blank lines", () => {
    const csv = "nama,email,kelas\nBudi,budi@example.com,Kelas A\n\nSiti,siti@example.com,Kelas B\n";
    const rows = parseInvitationCsv(Buffer.from(csv));
    expect(rows).toHaveLength(2);
  });

  it("leaves missing columns as empty strings rather than throwing (caller validates)", () => {
    const csv = "nama,email,kelas\nBudi,,Kelas A\n";
    const rows = parseInvitationCsv(Buffer.from(csv));
    expect(rows[0]?.email).toBe("");
  });
});
