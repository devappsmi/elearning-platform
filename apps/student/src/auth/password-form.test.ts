import { describe, expect, it } from "vitest";
import { PASSWORD_HINT, newPasswordProblem } from "./password-form";

describe("newPasswordProblem (AUTH-02, pesan Indonesia)", () => {
  it("password sah + konfirmasi sama -> null", () => {
    expect(newPasswordProblem("Abcdef12", "Abcdef12")).toBeNull();
  });

  it("terlalu pendek", () => {
    expect(newPasswordProblem("abc12", "abc12")).toBe("Password minimal 8 karakter.");
  });

  it.each(["abcdefgh", "12345678"])("%j tanpa huruf/angka", (password) => {
    expect(newPasswordProblem(password, password)).toBe("Password harus mengandung huruf dan angka.");
  });

  it("konfirmasi tidak sama", () => {
    expect(newPasswordProblem("Abcdef12", "Abcdef13")).toBe("Konfirmasi password tidak sama.");
  });

  it("pelanggaran kebijakan didahulukan atas ketidaksamaan konfirmasi", () => {
    expect(newPasswordProblem("abc", "xyz")).toBe("Password minimal 8 karakter.");
  });

  it("petunjuk di bawah field memuat angka aturan yang sama", () => {
    expect(PASSWORD_HINT).toBe("Minimal 8 karakter, mengandung huruf dan angka.");
  });
});
