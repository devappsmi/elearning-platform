import { createHash } from "node:crypto";

export type AudioVoice = "female" | "male";

/** PRD §9.4: cache key = hash teks JP. `AudioAsset.textHash` sengaja string
 * opaque (bukan constraint sha256(text) di level DB, lihat schema.prisma) --
 * kita masukkan `voice` ke input hash dari awal (bukan cuma sha256(text))
 * supaya siap dipakai TutorModule nanti (Milestone 11, per-karakter voice
 * beda) tanpa perlu migrasi/skema baru, persis seperti dicatat di komentar
 * skema. Dipakai bersama oleh AudioService (tulis) dan content.mapper.ts
 * (baca, cari AudioAsset yang cocok) supaya kuncinya konsisten. */
export function hashAudioKey(textJp: string, voice: AudioVoice): string {
  return createHash("sha256").update(`${textJp}|${voice}`).digest("hex");
}
