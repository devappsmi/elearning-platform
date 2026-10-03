import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email.util";

describe("normalizeEmail", () => {
  it.each([
    ["Budi@Example.com", "budi@example.com"],
    ["BUDI@EXAMPLE.COM", "budi@example.com"],
    ["  budi@example.com  ", "budi@example.com"],
    ["\tBudi@Example.com\n", "budi@example.com"],
    ["budi@example.com", "budi@example.com"],
  ])("%j -> %j", (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  it("idempoten: menormalkan hasil normalisasi tidak mengubah apa pun", () => {
    for (const input of ["Budi@Example.COM", "  A.B+Tag@X.co.id ", "İ@example.com", "ΑΣ@example.com"]) {
      const once = normalizeEmail(input);
      expect(normalizeEmail(once)).toBe(once);
    }
  });

  // Tidak ada kanonikalisasi ala Gmail: titik dan "+tag" adalah bagian alamat yang sah.
  it("titik dan +tag di local-part TIDAK diubah", () => {
    expect(normalizeEmail("Budi.Santoso+Kelas1@Example.com")).toBe("budi.santoso+kelas1@example.com");
  });

  it("dua ejaan huruf yang berbeda menghasilkan kunci yang sama (dasar kunci lockout/kuota per email)", () => {
    expect(normalizeEmail("Budi@Example.com")).toBe(normalizeEmail(" budi@EXAMPLE.COM "));
  });

  // `toLowerCase()`, bukan `toLocaleLowerCase()`: hasilnya tidak boleh bergantung pada locale server
  // (di locale Turki "I".toLocaleLowerCase() menjadi "ı" tanpa titik, dan alamat berbeda dari "i").
  it("tidak bergantung pada locale (I -> i)", () => {
    expect(normalizeEmail("INFO@EXAMPLE.COM")).toBe("info@example.com");
  });
});
