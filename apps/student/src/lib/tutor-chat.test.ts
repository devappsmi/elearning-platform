import { describe, expect, it } from "vitest";
import { NETWORK_ERROR_TEXT } from "../auth/api-errors";
import {
  buildHistory,
  classifyFailure,
  clipTurnText,
  failureText,
  formatElapsed,
  openerFor,
  readyDraft,
  recorderProblemText,
  TUTOR_HELP_REQUEST_TEXT,
  TUTOR_MAX_HISTORY_TURNS,
  TUTOR_MAX_TURN_CHARS,
  TUTOR_PATH,
} from "./tutor-chat";
import type { ChatMessage, FailureKind, RecorderProblem, TutorAction } from "./tutor-chat";

function turn(id: number, role: ChatMessage["role"], text: string, kind: ChatMessage["kind"] = "turn"): ChatMessage {
  return { id, role, text, kind };
}

const QUOTA = { limit: 20, used: 20, remaining: 0, resetsAt: "2026-10-04T00:00:00.000Z" };

describe("clipTurnText", () => {
  it("memangkas spasi di tepi dan membiarkan teks pendek apa adanya", () => {
    expect(clipTurnText("  はじめまして。  ")).toBe("はじめまして。");
  });

  it("memotong tepat di batas server (500 karakter)", () => {
    const clipped = clipTurnText("あ".repeat(TUTOR_MAX_TURN_CHARS + 25));
    expect(Array.from(clipped)).toHaveLength(TUTOR_MAX_TURN_CHARS);
  });

  it("menghitung per titik kode seperti validator server: emoji berpasangan-pengganti dihitung satu", () => {
    const clipped = clipTurnText("😀".repeat(TUTOR_MAX_TURN_CHARS + 5));
    expect(Array.from(clipped)).toHaveLength(TUTOR_MAX_TURN_CHARS);
    expect(Array.from(clipped).every((ch) => ch === "😀")).toBe(true);
  });
});

describe("buildHistory", () => {
  it("hanya giliran roleplay, berurutan, dengan peran apa adanya", () => {
    const history = buildHistory([turn(1, "user", "こんにちは。"), turn(2, "assistant", "こんにちは！"), turn(3, "user", "はじめまして。")]);

    expect(history).toEqual([
      { role: "user", text: "こんにちは。" },
      { role: "assistant", text: "こんにちは！" },
      { role: "user", text: "はじめまして。" },
    ]);
  });

  it("kartu contoh jawaban (tip) tidak ikut riwayat", () => {
    const history = buildHistory([turn(1, "user", "a"), turn(2, "assistant", "Contoh jawaban: ...", "tip"), turn(3, "user", "b")]);

    expect(history.map((t) => t.text)).toEqual(["a", "b"]);
  });

  it("giliran tambahan murid ditaruh paling akhir (permintaan bantuan)", () => {
    const history = buildHistory([turn(1, "user", "a"), turn(2, "assistant", "b")], TUTOR_HELP_REQUEST_TEXT);

    expect(history.at(-1)).toEqual({ role: "user", text: TUTOR_HELP_REQUEST_TEXT });
    expect(history).toHaveLength(3);
  });

  it("riwayat kosong + giliran tambahan = satu giliran murid", () => {
    expect(buildHistory([], TUTOR_HELP_REQUEST_TEXT)).toEqual([{ role: "user", text: TUTOR_HELP_REQUEST_TEXT }]);
  });

  it(`dipangkas ke ${TUTOR_MAX_HISTORY_TURNS} giliran TERAKHIR (yang lama dibuang, giliran terakhir tetap ada)`, () => {
    const many = Array.from({ length: 60 }, (_, i) => turn(i + 1, i % 2 === 0 ? "user" : "assistant", `giliran-${i + 1}`));
    many.push(turn(61, "user", "terakhir"));

    const history = buildHistory(many);

    expect(history).toHaveLength(TUTOR_MAX_HISTORY_TURNS);
    expect(history.at(-1)).toEqual({ role: "user", text: "terakhir" });
    expect(history[0]?.text).toBe("giliran-22");
  });

  it("pemangkasan juga berlaku bila ada giliran tambahan, dan giliran tambahan tidak pernah terbuang", () => {
    const many = Array.from({ length: 50 }, (_, i) => turn(i + 1, i % 2 === 0 ? "user" : "assistant", `g${i + 1}`));

    const history = buildHistory(many, TUTOR_HELP_REQUEST_TEXT);

    expect(history).toHaveLength(TUTOR_MAX_HISTORY_TURNS);
    expect(history.at(-1)?.text).toBe(TUTOR_HELP_REQUEST_TEXT);
  });

  it("teks yang melebihi batas karakter per giliran dipotong (balasan AI panjang tidak boleh membuat permintaan berikutnya 400)", () => {
    const history = buildHistory([turn(1, "user", "a"), turn(2, "assistant", "い".repeat(TUTOR_MAX_TURN_CHARS + 100))]);

    expect(Array.from(history[1]!.text)).toHaveLength(TUTOR_MAX_TURN_CHARS);
  });
});

describe("readyDraft", () => {
  it("null untuk kosong atau hanya spasi", () => {
    expect(readyDraft("")).toBeNull();
    expect(readyDraft("   \t ")).toBeNull();
  });

  it("teks dipangkas", () => {
    expect(readyDraft("  こんにちは。 ")).toBe("こんにちは。");
  });
});

describe("openerFor", () => {
  it.each([
    ["perkenalan", "はじめまして。"],
    ["restoran", "すみません。"],
    ["arah", "すみません、えきはどこですか。"],
    ["belanja", "すみません、これはいくらですか。"],
  ])("situasi %s", (id, expected) => {
    expect(openerFor(id)).toBe(expected);
  });

  it("situasi yang belum dikenal memakai sapaan umum", () => {
    expect(openerFor("situasi-baru")).toBe("こんにちは。");
  });
});

describe("formatElapsed", () => {
  it.each([
    [0, "0:00"],
    [999, "0:00"],
    [7_400, "0:07"],
    [65_000, "1:05"],
    [30_000, "0:30"],
    [-5, "0:00"],
  ])("%d ms -> %s", (ms, text) => {
    expect(formatElapsed(ms)).toBe(text);
  });
});

describe("classifyFailure", () => {
  it("429 dengan badan quota yang lengkap = jatah habis, jatah terbaru ikut dibawa", () => {
    expect(classifyFailure(429, { statusCode: 429, message: "Kuota harian AI tutor habis.", quota: QUOTA })).toEqual({ kind: "quota", quota: QUOTA });
  });

  it.each([
    ["badan kosong", undefined],
    ["tanpa quota", { statusCode: 429, message: "ThrottlerException: Too Many Requests" }],
    ["quota bukan objek", { quota: "habis" }],
    ["quota tidak lengkap", { quota: { limit: 20 } }],
  ])("429 biasa (%s) = terlalu sering memanggil, bukan jatah habis", (_label, body) => {
    expect(classifyFailure(429, body)).toEqual({ kind: "throttled" });
  });

  it.each([
    [503, "not-configured"],
    [502, "upstream"],
    [415, "unsupported-audio"],
    [413, "too-large"],
    [400, "bad-request"],
    [500, "unknown"],
    [401, "unknown"],
    [0, "unknown"],
  ] as const)("status %d = %s", (status, kind) => {
    expect(classifyFailure(status, { message: "apa saja" }).kind).toBe(kind);
  });
});

describe("failureText", () => {
  const kinds: FailureKind[] = ["quota", "throttled", "not-configured", "upstream", "unsupported-audio", "too-large", "bad-request", "network", "unknown"];
  const actions: TutorAction[] = ["reply", "transcribe", "speak"];

  it("setiap kombinasi menghasilkan teks Indonesia yang tidak kosong dan tanpa istilah teknis", () => {
    for (const kind of kinds) {
      for (const action of actions) {
        const text = failureText(kind, action);
        expect(text.length, `${kind}/${action}`).toBeGreaterThan(10);
        expect(text).not.toMatch(/throttl|exception|openai|undefined|\b50\d\b|\b4\d\d\b/i);
      }
    }
  });

  it("gangguan jaringan memakai teks jaringan yang sama dengan halaman lain", () => {
    for (const action of actions) expect(failureText("network", action)).toBe(NETWORK_ERROR_TEXT);
  });

  it("balasan: jatah habis, belum aktif, dan AI bermasalah punya pesan masing-masing (dan menenangkan soal jatah)", () => {
    expect(failureText("quota", "reply")).toContain("habis");
    expect(failureText("not-configured", "reply")).toContain("belum diaktifkan");
    expect(failureText("upstream", "reply")).toContain("Jatahmu tidak terpotong");
  });

  it("rekaman: selalu menawarkan jalan keluar mengetik bila suara tidak bisa dipakai", () => {
    expect(failureText("not-configured", "transcribe")).toContain("mengetik");
    expect(failureText("unsupported-audio", "transcribe")).toContain("Ketik");
    expect(failureText("upstream", "transcribe")).toContain("ketik");
  });

  it("suara balasan: satu pesan singkat apa pun penyebabnya", () => {
    expect(new Set(["upstream", "not-configured", "throttled", "unknown"].map((k) => failureText(k as FailureKind, "speak"))).size).toBe(1);
  });
});

describe("recorderProblemText", () => {
  const problems: RecorderProblem[] = ["denied", "no-device", "failed", "too-short", "insecure", "unsupported"];

  it("setiap masalah punya teks, dan masalah izin/perangkat/HTTPS menunjukkan cara mengatasinya", () => {
    for (const problem of problems) expect(recorderProblemText(problem).length).toBeGreaterThan(10);
    expect(recorderProblemText("denied")).toContain("pengaturan browser");
    expect(recorderProblemText("insecure")).toContain("HTTPS");
    expect(recorderProblemText("no-device")).toContain("mengetik");
  });
});

describe("TUTOR_PATH", () => {
  it("di bawah /conversation (menu Percakapan tetap menyala) tetapi bukan id skenario yang lazim", () => {
    expect(TUTOR_PATH.startsWith("/conversation/")).toBe(true);
    expect(TUTOR_PATH).not.toBe("/conversation/perkenalan");
  });
});
