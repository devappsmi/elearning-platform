import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageService } from "./local-storage.service";

let root: string;
let storage: LocalStorageService;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "elearning-media-"));
  storage = new LocalStorageService(root, "https://app.contoh.id/media/");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const KEY = "audio/0123abcd.mp3";

describe("LocalStorageService.upload", () => {
  it("menulis berkas di bawah kunci dan mengembalikan alamat publik (garis miring akhir alamat dasar dibuang)", async () => {
    const url = await storage.upload(KEY, Buffer.from("isi audio"), "audio/mpeg");

    expect(url).toBe("https://app.contoh.id/media/audio/0123abcd.mp3");
    expect((await readFile(join(root, KEY))).toString()).toBe("isi audio");
  });

  it("membuat direktori bertingkat yang belum ada dan menyetel direktori INDUK berkas 0777 (proses beruid lain -- mis. seed sebagai root vs API -- tetap bisa menulis)", async () => {
    await storage.upload("audio/sub/dalam/x.mp3", Buffer.from("a"), "audio/mpeg");

    for (const dir of ["audio", "audio/sub", "audio/sub/dalam"]) {
      expect((await stat(join(root, dir))).isDirectory()).toBe(true);
    }
    expect((await stat(join(root, "audio/sub/dalam"))).mode & 0o777).toBe(0o777);
  });

  it("berkas dibuat 0644 dan TIDAK menyisakan berkas sementara sesudah selesai", async () => {
    await storage.upload(KEY, Buffer.from("x"), "audio/mpeg");

    expect((await stat(join(root, KEY))).mode & 0o777).toBe(0o644);
    expect(await readdir(join(root, "audio"))).toEqual(["0123abcd.mp3"]);
  });

  it("menimpa berkas yang sudah ada (isi baru utuh, bukan gabungan)", async () => {
    await storage.upload(KEY, Buffer.from("lama-lama-lama"), "audio/mpeg");
    await storage.upload(KEY, Buffer.from("baru"), "audio/mpeg");

    expect((await readFile(join(root, KEY))).toString()).toBe("baru");
  });

  it("dua penulisan serentak untuk kunci yang sama menyisakan salah satu isi UTUH dan tanpa berkas sementara", async () => {
    const a = Buffer.alloc(200_000, 0x41);
    const b = Buffer.alloc(150_000, 0x42);

    await Promise.all([storage.upload(KEY, a, "audio/mpeg"), storage.upload(KEY, b, "audio/mpeg")]);

    const final = await readFile(join(root, KEY));
    expect([a.equals(final), b.equals(final)]).toContainEqual(true);
    expect(await readdir(join(root, "audio"))).toEqual(["0123abcd.mp3"]);
  });

  it("contentType diabaikan (tipe dilayani dari ekstensi saat disajikan)", async () => {
    await expect(storage.upload(KEY, Buffer.from("x"), "sesuatu/aneh")).resolves.toContain("/media/");
  });

  it("direktori tujuan tak bisa dibuat (sebuah berkas menghalangi) -> galat dilempar, tak ada yang tertulis", async () => {
    await writeFile(join(root, "audio"), "bukan direktori");

    await expect(storage.upload(KEY, Buffer.from("x"), "audio/mpeg")).rejects.toThrow();
    expect(await readdir(root)).toEqual(["audio"]);
  });

  it("rename gagal (tujuan berupa direktori berisi) -> galat dilempar dan berkas sementara DIBERSIHKAN", async () => {
    await mkdir(join(root, KEY), { recursive: true });
    await writeFile(join(root, KEY, "isi"), "menghalangi rename");

    await expect(storage.upload(KEY, Buffer.from("x"), "audio/mpeg")).rejects.toThrow();
    expect(await readdir(join(root, "audio"))).toEqual(["0123abcd.mp3"]); // hanya direktori penghalang; tak ada .tmp
  });
});

describe("LocalStorageService -- kunci berbahaya ditolak SEBELUM menyentuh disk", () => {
  it.each([
    ["../luar.mp3"],
    ["audio/../../luar.mp3"],
    ["audio/../luar.mp3"],
    ["/etc/passwd"],
    ["audio//dobel.mp3"],
    ["audio\\win.mp3"],
    ["audio/spasi terlarang.mp3"],
    ["audio/%2e%2e/x.mp3"],
    ["audio/null\u0000byte.mp3"],
    [".tersembunyi"],
    ["audio/.tersembunyi.mp3"],
    ["audio/"],
    [""],
    ["."],
    [".."],
  ])("kunci %j", async (key) => {
    await expect(storage.upload(key, Buffer.from("x"), "audio/mpeg")).rejects.toThrow(/Kunci penyimpanan/);

    expect(await readdir(root)).toEqual([]);
  });
});
