import { describe, expect, it } from "vitest";
import { weekKey } from "./week.util";

describe("weekKey", () => {
  it("maps a Monday to itself", () => {
    expect(weekKey(new Date(2024, 0, 1))).toBe("2024-01-01"); // Senin
  });

  it("maps the rest of the week to that Monday", () => {
    expect(weekKey(new Date(2024, 0, 3))).toBe("2024-01-01"); // Rabu
    expect(weekKey(new Date(2024, 0, 7))).toBe("2024-01-01"); // Minggu (hari terakhir minggu itu)
  });

  it("rolls over to the next Monday once the week turns", () => {
    expect(weekKey(new Date(2024, 0, 8))).toBe("2024-01-08"); // Senin berikutnya
  });

  it("is stable regardless of time-of-day", () => {
    const morning = new Date(2024, 0, 3, 0, 1);
    const night = new Date(2024, 0, 3, 23, 59);
    expect(weekKey(morning)).toBe(weekKey(night));
  });
});
