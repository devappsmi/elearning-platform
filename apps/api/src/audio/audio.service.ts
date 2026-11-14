import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TtsClient } from "./tts-client";
import type { AudioStorage } from "./audio-storage";
import { hashAudioKey, type AudioVoice } from "./audio-hash.util";

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

export interface ResolveAudioOptions {
  /** Abaikan cache dan buat audionya ulang (lihat `resolveAudioUrlWith`). */
  refresh?: boolean;
}

/** PRD §9.4: pipeline cache audio-by-hash. Dipakai dari dua tempat dengan
 * cara konstruksi berbeda -- lewat NestJS DI di dalam app (AudioModule), dan
 * dikonstruksi langsung (bukan lewat Nest) dari `seed.ts` untuk pre-generate
 * audio konten sekali di waktu seed, BUKAN on-demand saat `GET /lessons/:id`
 * (lihat catatan di ContentService/seed.ts -- generate TTS sinkron per
 * request akan melanggar NFR "API p95 < 300ms" telak; endpoint lesson cuma
 * baca AudioAsset yang sudah ada). Konstruktor nerima `PrismaClient`
 * (bukan spesifik `PrismaService`) supaya `new PrismaClient()` biasa di
 * seed.ts juga valid -- `PrismaService extends PrismaClient`. */
@Injectable()
export class AudioService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    private readonly tts: TtsClient,
    @Inject(OBJECT_STORAGE) private readonly storage: AudioStorage,
  ) {}

  /** Cache hit -> langsung kembalikan s3Url tersimpan, TIDAK memanggil TTS
   * provider lagi (persis kriteria verifikasi Milestone 8 di docs/PLAN.md).
   * Cache miss -> generate + upload + `upsert` (bukan `create` polos --
   * `textHash` unique, upsert-ke-no-op menghindari crash kalau dua panggilan
   * untuk teks baru yang sama kebetulan race; pemborosan satu panggilan TTS
   * ekstra pada race itu diterima, mengunci akan berlebihan untuk kasus yang
   * jarang terjadi). */
  async resolveAudioUrl(textJp: string, voice: AudioVoice = "female", options: ResolveAudioOptions = {}): Promise<string> {
    return this.resolveAudioUrlWith(textJp, voice, () => this.tts.synthesize(textJp, voice), options);
  }

  /** Varian generik untuk pemanggil yang punya sintesizer + "kunci suara"
   * sendiri -- TutorModule (Milestone 11) memakai OpenAI TTS dengan voice
   * per-karakter, bukan Azure `female`/`male` milik `TtsClient` di atas.
   * Tabel cache (`AudioAsset`), jalur upload S3, dan kunci hash-nya SAMA
   * dengan `resolveAudioUrl` -- satu jalur cache se-sistem, persis rencana
   * di docs/PLAN.md bagian 6 -- cuma penyedia audionya yang diinjeksi.
   * `voiceKey` HARUS memuat semua setelan yang mengubah bunyi audio
   * (provider/model/voice/instruksi), supaya setelan berbeda tidak saling
   * menimpa satu entri cache. `synthesize` dipanggil HANYA saat cache miss --
   * kecuali `options.refresh`: lewati cache dan buat ulang (dipakai seed saat
   * suara/penyedia TTS diganti). Berkasnya ditimpa di kunci yang SAMA (URL
   * tidak berubah) dan barisnya baru diperbarui SESUDAH berkas baru tersimpan,
   * jadi kegagalan di tengah jalan tidak pernah meninggalkan audio yang hilang:
   * teks yang belum sempat dibuat ulang tetap memakai audio lamanya. */
  async resolveAudioUrlWith(
    textJp: string,
    voiceKey: string,
    synthesize: () => Promise<Buffer>,
    options: ResolveAudioOptions = {},
  ): Promise<string> {
    const textHash = hashAudioKey(textJp, voiceKey);
    if (!options.refresh) {
      const existing = await this.prisma.audioAsset.findUnique({ where: { textHash } });
      if (existing) return existing.s3Url;
    }

    const audioBuffer = await synthesize();
    const s3Url = await this.storage.upload(`audio/${textHash}.mp3`, audioBuffer, "audio/mpeg");

    const asset = await this.prisma.audioAsset.upsert({
      where: { textHash },
      // Refresh: alamat publik bisa saja sudah berubah (STORAGE_PUBLIC_BASE_URL) -- ikut diperbarui.
      update: options.refresh ? { s3Url } : {},
      create: { textHash, textJp, s3Url },
    });
    return asset.s3Url;
  }
}
