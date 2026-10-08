import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { hashAudioKey } from "../audio/audio-hash.util";
import { loadAudioUrlsByHash } from "../audio/audio-lookup.util";
import type { DictionaryEntryDto } from "./dto/dictionary-entry.dto";

const SEARCH_LIMIT = 50;

/** SUP-01: "cari via romaji/kana/kanji/Indonesia". Pakai tabel `Vocab` yang
 * SUDAH ADA (schema.prisma) -- `unitId` nullable-nya JUSTRU untuk kasus ini,
 * entri kamus lepas dari lesson mana pun (lihat komentar skema: "SUP-01/02
 * butuh vocab yang bisa di-query relasional"). Target PRD "min. 1500 entri
 * N5" BELUM ADA -- authoring konten kamus terpisah, di luar scope kode (sama
 * seperti kurikulum Katakana/Dasar/N5/N4 di luar Hiragana, lihat docs/PLAN.md);
 * endpoint ini bekerja penuh terhadap Vocab APA PUN yang ada di DB, termasuk
 * yang cuma 104 entri Hiragana hasil seed Milestone 6 (fonetik murni, bukan
 * kosakata berarti -- pencarian tetap benar, hasilnya saja belum berguna
 * sebagai kamus sungguhan sampai konten N5 di-seed). */
@Injectable()
export class DictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string): Promise<DictionaryEntryDto[]> {
    const query = q.trim();
    if (query.length === 0) return [];

    const rows = await this.prisma.vocab.findMany({
      where: {
        OR: [
          { jp: { contains: query, mode: "insensitive" } },
          { reading: { contains: query, mode: "insensitive" } },
          { romaji: { contains: query, mode: "insensitive" } },
          { meaningId: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { jp: "asc" },
      take: SEARCH_LIMIT,
    });
    if (rows.length === 0) return [];

    const audioUrlByHash = await loadAudioUrlsByHash(
      this.prisma,
      rows.map((v) => hashAudioKey(v.jp, "female")),
    );

    return rows.map((v) => ({
      id: v.id,
      surface: v.jp,
      reading: v.reading,
      romaji: v.romaji,
      meaning: v.meaningId,
      partOfSpeech: v.partOfSpeech,
      exampleJp: v.exampleJp,
      exampleId: v.exampleId,
      audio: audioUrlByHash.get(hashAudioKey(v.jp, "female")) ?? "",
    }));
  }
}
