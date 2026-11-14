import type { components } from "@elearning/api-client";
import { NETWORK_ERROR_TEXT } from "../auth/api-errors";

/** Logika murni layar "Ngobrol dengan AI" (/tutor): riwayat untuk server, batas input, dan teks galat. Tanpa React dan tanpa
 * jaringan, supaya mudah dites. Kontrak servernya: apps/api/src/tutor (docs/PLAN.md bagian 6 dan 7m). */

/** Alamat layar Ngobrol dengan AI. Di bawah /conversation supaya menu Percakapan tetap menyala; namanya khusus supaya tidak
 * bentrok dengan id skenario (/conversation/:id). */
export const TUTOR_PATH = "/conversation/ngobrol-ai";

export type TutorQuota = components["schemas"]["TutorQuotaDto"];
export type TutorTurn = components["schemas"]["TutorTurnDto"];

/** Batas yang ditegakkan server (apps/api/src/tutor/dto/tutor-reply.dto.ts): lebih dari ini ditolak 400. */
export const TUTOR_MAX_HISTORY_TURNS = 40;
export const TUTOR_MAX_TURN_CHARS = 500;

/** Kalimat penanda minta bantuan. Server mewajibkan giliran terakhir riwayat dari murid, sedangkan murid yang buntu
 * biasanya baru saja menerima balasan AI, jadi permintaan bantuan ditutup dengan giliran sintetis ini (tidak disimpan di riwayat). */
export const TUTOR_HELP_REQUEST_TEXT = "Tolong bantu aku menjawab.";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** `turn` = giliran roleplay (ikut riwayat). `tip` = kartu contoh jawaban dari mode bantuan: tampil di layar, tidak ikut riwayat. */
  kind: "turn" | "tip";
  /** Hanya giliran murid: lewat suara (hasil transkripsi, boleh sudah diperbaiki) atau diketik. */
  via?: "voice" | "typed";
}

/** Potong sampai batas karakter server (dihitung per titik kode, sama dengan validator server). */
export function clipTurnText(text: string): string {
  const chars = Array.from(text.trim());
  return chars.length <= TUTOR_MAX_TURN_CHARS ? chars.join("") : chars.slice(0, TUTOR_MAX_TURN_CHARS).join("");
}

/** Riwayat untuk POST /tutor/reply: hanya giliran roleplay, dipangkas ke 40 giliran terakhir (giliran terakhir tetap utuh).
 * `extraUserText`: giliran murid tambahan di ujung (dipakai permintaan bantuan). */
export function buildHistory(messages: readonly ChatMessage[], extraUserText?: string): TutorTurn[] {
  const turns: TutorTurn[] = messages.filter((m) => m.kind === "turn").map((m) => ({ role: m.role, text: clipTurnText(m.text) }));
  if (extraUserText !== undefined) turns.push({ role: "user", text: clipTurnText(extraUserText) });
  return turns.slice(-TUTOR_MAX_HISTORY_TURNS);
}

/** Teks siap kirim, atau `null` bila kosong. */
export function readyDraft(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Kalimat pembuka yang disarankan per situasi (kalimat N5 yang baku; untuk situasi baru dipakai sapaan umum). */
const OPENERS: Record<string, string> = {
  perkenalan: "はじめまして。",
  restoran: "すみません。",
  arah: "すみません、えきはどこですか。",
  belanja: "すみません、これはいくらですか。",
};
const DEFAULT_OPENER = "こんにちは。";

export function openerFor(scenarioId: string): string {
  return OPENERS[scenarioId] ?? DEFAULT_OPENER;
}

/** 7 -> "0:07", 65 -> "1:05" (dari milidetik). */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// ---- Galat ------------------------------------------------------------------------------------------------------------

export type FailureKind =
  | "quota" // 429 dengan badan `quota`: jatah harian habis
  | "throttled" // 429 biasa: terlalu sering memanggil
  | "not-configured" // 503: server belum punya kunci OpenAI
  | "upstream" // 502: penyedia AI bermasalah
  | "unsupported-audio" // 415
  | "too-large" // 413
  | "bad-request" // 400
  | "network" // fetch melempar
  | "unknown";

export type TutorAction = "reply" | "transcribe" | "speak";

export interface TutorFailure {
  kind: FailureKind;
  /** Jatah terbaru bila server menyertakannya (galat `quota`). */
  quota?: TutorQuota;
}

function quotaFrom(body: unknown): TutorQuota | undefined {
  if (typeof body !== "object" || body === null || !("quota" in body)) return undefined;
  const quota = (body as { quota: unknown }).quota;
  if (typeof quota !== "object" || quota === null) return undefined;
  const q = quota as Partial<TutorQuota>;
  return typeof q.limit === "number" && typeof q.used === "number" && typeof q.remaining === "number" && typeof q.resetsAt === "string"
    ? (q as TutorQuota)
    : undefined;
}

/** Klien openapi-fetch tidak melempar untuk respons non-2xx: `status` dari `response`, `body` dari `error`. */
export function classifyFailure(status: number, body: unknown): TutorFailure {
  if (status === 429) {
    const quota = quotaFrom(body);
    return quota ? { kind: "quota", quota } : { kind: "throttled" };
  }
  if (status === 503) return { kind: "not-configured" };
  if (status === 502) return { kind: "upstream" };
  if (status === 415) return { kind: "unsupported-audio" };
  if (status === 413) return { kind: "too-large" };
  if (status === 400) return { kind: "bad-request" };
  return { kind: "unknown" };
}

export const NETWORK_FAILURE: TutorFailure = { kind: "network" };

/** Teks untuk murid (tidak pernah memakai pesan mentah dari server). */
export function failureText(kind: FailureKind, action: TutorAction): string {
  if (kind === "network") return NETWORK_ERROR_TEXT;
  if (action === "speak") return "Suara belum tersedia untuk balasan ini.";
  if (action === "transcribe") {
    switch (kind) {
      case "not-configured":
        return "Fitur suara belum diaktifkan di server ini. Kamu tetap bisa mengetik jawabanmu.";
      case "upstream":
        return "Suaramu belum bisa dikenali. Coba rekam lagi, atau ketik jawabanmu.";
      case "unsupported-audio":
        return "Format rekaman dari browser ini belum didukung. Ketik saja jawabanmu.";
      case "too-large":
        return "Rekamannya terlalu panjang. Coba lebih singkat.";
      case "throttled":
      case "quota":
        return "Terlalu banyak rekaman dalam waktu singkat. Tunggu sebentar lalu coba lagi.";
      default:
        return "Rekamanmu belum bisa diproses. Coba lagi, atau ketik jawabanmu.";
    }
  }
  switch (kind) {
    case "quota":
      return "Jatah ngobrol hari ini sudah habis. Jatahmu kembali besok.";
    case "not-configured":
      return "Fitur ngobrol dengan AI belum diaktifkan di server ini. Hubungi admin lembaga.";
    case "throttled":
      return "Terlalu banyak permintaan dalam waktu singkat. Tunggu sebentar lalu coba lagi.";
    case "upstream":
      return "Layanan AI sedang bermasalah. Coba lagi sebentar lagi. Jatahmu tidak terpotong.";
    default:
      return "Pesanmu belum terkirim. Coba lagi.";
  }
}

export type RecorderProblem = "denied" | "no-device" | "failed" | "too-short" | "insecure" | "unsupported";

export function recorderProblemText(problem: RecorderProblem): string {
  switch (problem) {
    case "denied":
      return "Izin mikrofon ditolak. Aktifkan izin mikrofon untuk situs ini di pengaturan browser, atau ketik jawabanmu.";
    case "no-device":
      return "Mikrofon tidak ditemukan di perangkat ini. Kamu bisa mengetik jawabanmu.";
    case "failed":
      return "Mikrofon tidak bisa dipakai. Coba lagi, atau ketik jawabanmu.";
    case "too-short":
      return "Rekamannya terlalu singkat. Coba lagi dan bicara sedikit lebih lama.";
    case "insecure":
      return "Rekam suara hanya berfungsi lewat alamat HTTPS. Kamu bisa mengetik jawabanmu.";
    case "unsupported":
      return "Browser ini belum mendukung rekam suara. Kamu bisa mengetik jawabanmu.";
  }
}
