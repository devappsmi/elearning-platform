import "reflect-metadata";
import { request } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { serveLocalMedia } from "./local-media";

// /media lewat HTTP NYATA (Nest + Express + helmet seperti main.ts; hanya modulnya kosong): yang dibuktikan adalah
// PERILAKU penyajiannya -- tipe, Range, cache, header lintas-origin di atas helmet -- dan bahwa direktori lain, berkas
// tersembunyi, daftar isi, maupun tulisan dari luar TIDAK bisa dicapai lewat URL. Direktori penyimpanan dibuat DI DALAM
// induk berisi `rahasia.txt` supaya percobaan naik direktori (`..`) punya sasaran nyata.

const AUDIO = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 4, 0, 0]), Buffer.alloc(2000, 7)]);

@Controller()
class ProbeController {
  @Get("kesehatan")
  ping() {
    return { status: "ok" };
  }
}

@Module({ controllers: [ProbeController] })
class TestModule {}

let parent: string;
let mediaDir: string;
let app: NestExpressApplication | undefined;
let base: string;
let port: number;

beforeEach(async () => {
  parent = await mkdtemp(join(tmpdir(), "elearning-media-http-"));
  mediaDir = join(parent, "media");
  await mkdir(join(mediaDir, "audio"), { recursive: true });
  await writeFile(join(mediaDir, "audio", "abc123.mp3"), AUDIO);
  await writeFile(join(mediaDir, "audio", ".rahasia.tmp"), "berkas sementara");
  await writeFile(join(mediaDir, "audio", "index.html"), "INDEX TERLARANG"); // `index: false` harus mencegah ini tampil sebagai "halaman direktori"
  await writeFile(join(parent, "rahasia.txt"), "DI LUAR DIREKTORI PENYIMPANAN");

  app = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
  app.use(helmet()); // sama dengan main.ts: helmet lebih dulu, baru penyajian media
  serveLocalMedia(app, mediaDir);
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  port = Number(new URL(base).port);
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(parent, { recursive: true, force: true });
});

/** Permintaan mentah supaya jalur TIDAK dinormalkan klien (fetch/URL akan menghapus `..`). */
function raw(method: string, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, method, path }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf-8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("GET /media/<kunci>", () => {
  it("menyajikan berkas: 200, tipe audio/mpeg (dari ekstensi), isi utuh, Range didukung", async () => {
    const response = await fetch(`${base}/media/audio/abc123.mp3`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(Buffer.from(await response.arrayBuffer()).equals(AUDIO)).toBe(true);
  });

  it("Range (seek audio) -> 206 dengan Content-Range dan potongan yang benar", async () => {
    const response = await fetch(`${base}/media/audio/abc123.mp3`, { headers: { range: "bytes=0-99" } });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(`bytes 0-99/${AUDIO.length}`);
    expect(Buffer.from(await response.arrayBuffer()).equals(AUDIO.subarray(0, 100))).toBe(true);
  });

  it("HEAD -> 200 dengan panjang isi, tanpa badan", async () => {
    const response = await fetch(`${base}/media/audio/abc123.mp3`, { method: "HEAD" });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe(String(AUDIO.length));
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  it("cache 1 hari dan Cross-Origin-Resource-Policy: cross-origin MENIMPA nilai same-origin dari helmet (audio lintas-origin di dev)", async () => {
    const response = await fetch(`${base}/media/audio/abc123.mp3`);

    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff"); // helmet tetap aktif
  });

  it("route API lain tidak terganggu penyajian statis", async () => {
    const response = await fetch(`${base}/kesehatan`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

describe("/media -- yang TIDAK boleh bisa dicapai", () => {
  it("berkas tidak ada -> 404 dari aplikasi (JSON), bukan halaman galat mentah", async () => {
    const response = await fetch(`${base}/media/audio/tidak-ada.mp3`);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it.each([["/media/audio/"], ["/media/audio"], ["/media/"], ["/media"]])("direktori %s: tanpa daftar isi dan tanpa pengalihan", async (path) => {
    const response = await fetch(`${base}${path}`, { redirect: "manual" });

    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).not.toContain("abc123.mp3");
    expect(text).not.toContain("INDEX TERLARANG");
  });

  it("berkas berawalan titik (termasuk .tmp milik penulisan yang sedang berjalan) tidak disajikan", async () => {
    const response = await fetch(`${base}/media/audio/.rahasia.tmp`);

    expect(response.status).not.toBe(200);
    expect(await response.text()).not.toContain("berkas sementara");
  });

  it.each([
    ["/media/../rahasia.txt"],
    ["/media/%2e%2e/rahasia.txt"],
    ["/media/..%2frahasia.txt"],
    ["/media/audio/../../rahasia.txt"],
    ["/media/audio/%2e%2e/%2e%2e/rahasia.txt"],
    ["/media/%2e%2e%2frahasia.txt"],
  ])("percobaan naik direktori %s tidak pernah membocorkan berkas di luar direktori penyimpanan", async (path) => {
    const response = await raw("GET", path);

    expect(response.status).not.toBe(200);
    expect(response.body).not.toContain("DI LUAR DIREKTORI PENYIMPANAN");
  });

  it.each([["POST"], ["PUT"], ["DELETE"], ["PATCH"]])("%s ke berkas yang ada tidak menyajikan (apalagi mengubah) apa pun", async (method) => {
    const response = await fetch(`${base}/media/audio/abc123.mp3`, { method });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});
