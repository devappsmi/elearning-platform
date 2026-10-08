import { createHash } from "node:crypto";

export type AudioVoice = "female" | "male";

/** PRD §9.4: cache key = hash teks JP. `AudioAsset.textHash` sengaja string
 * opaque (bukan constraint sha256(text) di level DB, lihat schema.prisma) --
 * kita masukkan `voice` ke input hash dari awal (bukan cuma sha256(text))
 * supaya TutorModule (Milestone 11, voice per-karakter) bisa memakai tabel
 * dan jalur cache yang SAMA tanpa migrasi/skema baru.
 *
 * `voice` sekarang `string` bebas (bukan cuma `AudioVoice`): konten lesson/
 * kamus/skenario tetap pakai 'female'|'male', TutorModule mengirim "kunci
 * suara" milik klien TTS-nya sendiri (provider+model+voice+instruksi,
 * lihat `TutorTtsClient.voiceKey`) -- string berbeda per kombinasi setelan
 * sintesis, jadi tidak pernah bentrok dengan 'female'/'male' maupun antar
 * karakter. Dipakai bersama oleh AudioService (tulis) dan content.mapper.ts
 * (baca, cari AudioAsset yang cocok) supaya kuncinya konsisten. */
export function hashAudioKey(textJp: string, voice: string): string {
  return createHash("sha256").update(`${textJp}|${voice}`).digest("hex");
}
