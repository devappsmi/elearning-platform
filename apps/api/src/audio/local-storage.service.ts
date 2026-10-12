import { randomBytes } from "node:crypto";
import { chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { AudioStorage } from "./audio-storage";

// Hanya karakter aman untuk nama berkas/direktori; kunci audio sungguhan berbentuk `audio/<hash heksadesimal>.mp3`.
const SAFE_KEY = /^[A-Za-z0-9_-]+(?:[./][A-Za-z0-9_-]+)*$/;

/** Penyimpanan audio di DISK LOKAL -- pilihan tahap uji coba, tanpa layanan S3. Berkas ditulis di bawah `rootDir`
 * dan disajikan API di `/media` (lihat local-media.ts); di Docker `rootDir` adalah volume `media_data`.
 *
 * - Penulisan ATOMIK: ditulis ke berkas sementara di direktori yang sama lalu di-`rename`, jadi pembaca (yang
 *   mengunduh audio saat itu juga) tidak pernah menerima berkas setengah jadi, dan dua penulisan serentak untuk
 *   kunci yang sama menyisakan salah satu isi utuh.
 * - AMAN dari path traversal: SAFE_KEY hanya menerima segmen `[A-Za-z0-9_-]+` yang dipisah satu `.` atau `/` -- jadi
 *   `..`, garis miring awal/ganda, backslash, spasi, dan karakter kontrol ditolak sebelum menyentuh disk. Kunci audio
 *   sungguhan (`audio/<hash heksadesimal>.mp3`) selalu lolos.
 * - Direktori INDUK berkas disetel 0777: proses lain dengan uid berbeda (mis. `tools` yang berjalan sebagai root untuk
 *   seed audio, sedangkan API berjalan sebagai `nestjs`) tetap bisa menambah berkas ke direktori yang sama. Volumenya
 *   privat untuk stack ini dan hanya dapat dibaca publik lewat `/media` (GET/HEAD). */
export class LocalStorageService implements AudioStorage {
  private readonly rootDir: string;
  private readonly publicBaseUrl: string;

  constructor(rootDir: string, publicBaseUrl: string) {
    this.rootDir = resolve(rootDir);
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, "");
  }

  /** `contentType` diabaikan: tipe dilayani dari ekstensi berkas saat disajikan (`.mp3` -> audio/mpeg). */
  async upload(key: string, body: Buffer, _contentType: string): Promise<string> {
    const target = this.resolveKey(key);
    const dir = dirname(target);
    await mkdir(dir, { recursive: true });
    // Direktori induk berkas dibuat 0777 lewat chmod eksplisit (mkdir sendiri dikurangi umask). Direktori milik uid
    // lain tidak bisa di-chmod (EPERM) -- itu berarti pembuatnya sudah menyetel izin yang sama, jadi galatnya diabaikan.
    await chmod(dir, 0o777).catch(() => undefined);

    const temp = join(dir, `.${randomBytes(8).toString("hex")}.tmp`);
    try {
      await writeFile(temp, body, { mode: 0o644 });
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
    return `${this.publicBaseUrl}/${key}`;
  }

  private resolveKey(key: string): string {
    if (!SAFE_KEY.test(key)) {
      throw new Error(`Kunci penyimpanan tidak valid: ${JSON.stringify(key)}`);
    }
    return resolve(this.rootDir, key);
  }
}
