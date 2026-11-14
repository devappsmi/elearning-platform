import { LocalStorageService } from "./local-storage.service";
import { ObjectStorageService } from "./object-storage.service";
import type { StorageOptions } from "./storage-options";

/** Tempat berkas audio hasil TTS disimpan. `upload` mengembalikan alamat PUBLIK objek (yang dibuka browser dan
 * disimpan di `AudioAsset.s3Url` -- nama kolom warisan dari masa S3-saja, isinya alamat driver mana pun). */
export interface AudioStorage {
  upload(key: string, body: Buffer, contentType: string): Promise<string>;
}

export function createAudioStorage(options: StorageOptions): AudioStorage {
  if (options.driver === "local") return new LocalStorageService(options.localDir, options.publicBaseUrl);
  return new ObjectStorageService(options.endpoint, options.region, options.bucket, options.accessKeyId, options.secretAccessKey, options.publicBaseUrl);
}
