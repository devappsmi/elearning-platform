import type { PrismaClient } from "@prisma/client";

/** Kunci hash -> URL audio (lihat audio-hash.util.ts). Hash yang belum ada
 * `AudioAsset`-nya (belum pernah digenerate, lihat seed.ts) sengaja tidak
 * masuk map -- caller jatuh ke placeholder "" untuk itu. */
export type AudioUrlByHash = ReadonlyMap<string, string>;

/** SATU query bulk (bukan N+1 per item) -- dipakai ContentService,
 * DictionaryService, dan FlashcardsService (tiga tempat berbeda yang semua
 * perlu "kata-kata ini, cari audio-nya kalau ada" -- diekstrak ke sini
 * supaya polanya cuma didefinisikan sekali). */
export async function loadAudioUrlsByHash(prisma: PrismaClient, hashes: string[]): Promise<AudioUrlByHash> {
  if (hashes.length === 0) return new Map();
  const rows = await prisma.audioAsset.findMany({
    where: { textHash: { in: hashes } },
    select: { textHash: true, s3Url: true },
  });
  return new Map(rows.map((r) => [r.textHash, r.s3Url]));
}
