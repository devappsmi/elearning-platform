import { describe, expect, it } from "vitest";
import { nextLocalMidnight, quotaKey, secondsUntilNextMidnight } from "./tutor-quota.util";

// Semua tanggal dibangun dari komponen LOKAL (pola week.util.test.ts) supaya
// tes tidak bergantung zona waktu mesin yang menjalankannya.

describe("quotaKey", () => {
  it("formatnya tutor_quota:{userId}:{tanggal lokal}", () => {
    expect(quotaKey("user-1", new Date(2024, 2, 5, 13, 0))).toBe("tutor_quota:user-1:2024-03-05");
  });

  it("hari yang sama, jam berbeda -> kunci sama; ganti hari -> kunci baru", () => {
    const morning = quotaKey("u", new Date(2024, 2, 5, 0, 1));
    const night = quotaKey("u", new Date(2024, 2, 5, 23, 59));
    const nextDay = quotaKey("u", new Date(2024, 2, 6, 0, 1));

    expect(morning).toBe(night);
    expect(nextDay).not.toBe(morning);
  });

  it("murid berbeda -> kunci berbeda pada hari yang sama", () => {
    const now = new Date(2024, 2, 5, 9, 0);
    expect(quotaKey("a", now)).not.toBe(quotaKey("b", now));
  });
});

describe("nextLocalMidnight", () => {
  it("tengah malam lokal hari berikutnya", () => {
    const next = nextLocalMidnight(new Date(2024, 2, 5, 13, 45));

    expect([next.getFullYear(), next.getMonth(), next.getDate(), next.getHours(), next.getMinutes(), next.getSeconds()]).toEqual([
      2024, 2, 6, 0, 0, 0,
    ]);
  });

  it("melewati batas bulan dan tahun", () => {
    const endOfMonth = nextLocalMidnight(new Date(2024, 0, 31, 12));
    expect([endOfMonth.getMonth(), endOfMonth.getDate()]).toEqual([1, 1]);

    const endOfYear = nextLocalMidnight(new Date(2024, 11, 31, 12));
    expect([endOfYear.getFullYear(), endOfYear.getMonth(), endOfYear.getDate()]).toEqual([2025, 0, 1]);
  });

  it("tepat tengah malam -> tengah malam BERIKUTNYA (bukan diri sendiri), sehingga reset tidak pernah 0 detik", () => {
    const midnight = new Date(2024, 2, 5, 0, 0, 0, 0);
    expect(nextLocalMidnight(midnight).getTime()).toBeGreaterThan(midnight.getTime());
  });
});

describe("secondsUntilNextMidnight", () => {
  it("sore hari -> beberapa jam lagi", () => {
    const seconds = secondsUntilNextMidnight(new Date(2024, 2, 5, 13, 0));
    // 11 jam; toleransi 1 jam untuk hari transisi DST di zona mana pun.
    expect(seconds).toBeGreaterThan(10 * 3600);
    expect(seconds).toBeLessThanOrEqual(12 * 3600);
  });

  it("dibulatkan ke atas dan TIDAK PERNAH < 1 (EXPIRE 0 menghapus key seketika)", () => {
    const almostMidnight = new Date(2024, 2, 5, 23, 59, 59, 900);
    expect(secondsUntilNextMidnight(almostMidnight)).toBe(1);
  });

  it("tepat tengah malam -> kira-kira sehari penuh", () => {
    const seconds = secondsUntilNextMidnight(new Date(2024, 2, 5, 0, 0, 0, 0));
    expect(seconds).toBeGreaterThanOrEqual(23 * 3600);
    expect(seconds).toBeLessThanOrEqual(25 * 3600);
  });
});
