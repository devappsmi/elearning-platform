import type { NestExpressApplication } from "@nestjs/platform-express";
import { resolve } from "node:path";

/** Menyajikan direktori penyimpanan LOKAL di `/media` (hanya GET/HEAD; berkas statis, Range didukung untuk seek audio).
 * Dipasang di main.ts hanya bila `STORAGE_DRIVER=local`. Di belakang Caddy, `/media/*` diteruskan ke sini (situs murid).
 *
 * - Tidak ada daftar isi direktori (`index: false`), tidak ada pengalihan (`redirect: false`), berkas berawalan titik
 *   ditolak (`dotfiles: "deny"` -- juga berkas sementara `.<acak>.tmp` milik LocalStorageService), path traversal
 *   ditangani modul `send` bawaan Express.
 * - Berkas ada di bawah nama berhash isi teks+suara, jadi cache 1 hari aman. */
export function serveLocalMedia(app: NestExpressApplication, dir: string): void {
  app.useStaticAssets(resolve(dir), {
    prefix: "/media/",
    index: false,
    redirect: false,
    dotfiles: "deny",
    fallthrough: true,
    maxAge: "1d",
    setHeaders: (res) => {
      // helmet menyetel Cross-Origin-Resource-Policy: same-origin untuk semua respons. Audio harus bisa dimuat lintas
      // origin pada pengembangan lokal (SPA di :5173, API di :3001); di produksi semuanya satu origin lewat Caddy.
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  });
}
