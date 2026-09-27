import { describe, expect, test } from "vitest";
import { generateOpaqueToken, hashOpaqueToken } from "./opaque-token.util";

describe("opaque token", () => {
  test("hashOpaqueToken(token) sama dengan tokenHash yang dihasilkan generateOpaqueToken", () => {
    const { token, tokenHash } = generateOpaqueToken();
    expect(hashOpaqueToken(token)).toBe(tokenHash);
  });

  test("dua token yang di-generate berbeda tidak pernah sama (dan hash-nya juga beda)", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  test("token mentah tidak pernah muncul di dalam hash-nya sendiri", () => {
    const { token, tokenHash } = generateOpaqueToken();
    expect(tokenHash).not.toContain(token);
  });

  test("hash deterministik untuk input yang sama", () => {
    const { token } = generateOpaqueToken();
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });
});
