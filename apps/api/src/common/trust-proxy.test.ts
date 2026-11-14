import { describe, expect, it } from "vitest";
import { parseTrustProxy } from "./trust-proxy";

describe("parseTrustProxy", () => {
  it.each([undefined, "", "   ", "0", "false", "FALSE", " False "])("%j -> false (tanpa proxy)", (value) => {
    expect(parseTrustProxy(value)).toBe(false);
  });

  it.each([
    ["1", 1],
    ["2", 2],
    [" 3 ", 3],
  ])("jumlah hop %j -> angka %d", (value, expected) => {
    expect(parseTrustProxy(value)).toBe(expected);
  });

  it.each(["loopback", "loopback, 10.0.0.0/8", "127.0.0.1"])("daftar subnet %j diteruskan apa adanya ke Express", (value) => {
    expect(parseTrustProxy(value)).toBe(value);
  });

  // "true" = percaya SEMUA X-Forwarded-For; klien bisa memalsukannya untuk melewati pembatas per-IP.
  it.each(["true", "TRUE", " true "])("%j DITOLAK dengan pesan yang menyebut alasannya", (value) => {
    expect(() => parseTrustProxy(value)).toThrow(/X-Forwarded-For/);
  });
});
