import { describe, expect, test } from "vitest";
import { addDuration } from "./duration.util";

describe("addDuration", () => {
  const base = new Date("2026-01-01T00:00:00.000Z");

  test("detik", () => {
    expect(addDuration(base, "30s").getTime()).toBe(base.getTime() + 30 * 1000);
  });

  test("menit", () => {
    expect(addDuration(base, "5m").getTime()).toBe(base.getTime() + 5 * 60_000);
  });

  test("jam (access token 1h)", () => {
    expect(addDuration(base, "1h").getTime()).toBe(base.getTime() + 3_600_000);
  });

  test("hari (refresh token 14d)", () => {
    expect(addDuration(base, "14d").getTime()).toBe(base.getTime() + 14 * 86_400_000);
  });

  test("melempar untuk format yang tidak dikenali", () => {
    expect(() => addDuration(base, "1w")).toThrow();
    expect(() => addDuration(base, "abc")).toThrow();
    expect(() => addDuration(base, "")).toThrow();
  });
});
