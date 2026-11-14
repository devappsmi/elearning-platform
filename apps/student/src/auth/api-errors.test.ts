import { describe, expect, it } from "vitest";
import { INVALID_INPUT_TEXT, failureText, readFailure } from "./api-errors";

const response = (status: number) => ({ status }) as Response;

describe("readFailure", () => {
  it("membaca message string (error bisnis NestJS)", () => {
    expect(readFailure(response(400), { message: "Undangan sudah kedaluwarsa", error: "Bad Request", statusCode: 400 })).toEqual({
      status: 400,
      message: "Undangan sudah kedaluwarsa",
    });
  });

  it("membaca message array (error validasi class-validator)", () => {
    expect(readFailure(response(400), { message: ["email must be an email"] })).toEqual({ status: 400, message: ["email must be an email"] });
  });

  it.each([undefined, null, "teks", 42, {}, { message: 5 }])("body error yang tak dikenal (%j) -> message null, tidak melempar", (error) => {
    expect(readFailure(response(500), error)).toEqual({ status: 500, message: null });
  });

  it("tanpa response (jaringan) -> status 0", () => {
    expect(readFailure(undefined, undefined).status).toBe(0);
  });
});

describe("failureText", () => {
  it("400 dengan pesan bisnis string diteruskan apa adanya (sudah Indonesia)", () => {
    expect(failureText({ status: 400, message: "Token reset tidak valid atau sudah kedaluwarsa" }, "cadangan")).toBe(
      "Token reset tidak valid atau sudah kedaluwarsa",
    );
  });

  it("400 dengan pesan validasi (array, Inggris) TIDAK ditampilkan -> teks cadangan", () => {
    expect(failureText({ status: 400, message: ["password must be longer than or equal to 8 characters"] }, INVALID_INPUT_TEXT)).toBe(INVALID_INPUT_TEXT);
  });

  it("429 -> teks Indonesia, bukan 'ThrottlerException'", () => {
    const text = failureText({ status: 429, message: "ThrottlerException: Too Many Requests" }, "cadangan");

    expect(text).toContain("Terlalu banyak percobaan");
    expect(text).not.toContain("Throttler");
  });

  it.each([500, 502, 503])("%i -> teks gangguan server", (status) => {
    expect(failureText({ status, message: "Internal server error" }, "cadangan")).toContain("gangguan di server");
  });

  it("status lain (401/404/0) -> teks cadangan", () => {
    expect(failureText({ status: 401, message: "Unauthorized" }, "cadangan")).toBe("cadangan");
    expect(failureText({ status: 0, message: null }, "cadangan")).toBe("cadangan");
  });
});
