import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ObjectStorageService } from "./object-storage.service";

// Server S3 TIRUAN lokal: menerima PUT apa pun dan mencatat yang SUNGGUH dikirim SDK -- supaya yang diuji adalah
// ke mana objek DIUNGGAH (endpoint internal) dan alamat apa yang DIKEMBALIKAN (alamat publik), dua hal yang
// harus terpisah begitu API berjalan di Docker (endpoint `http://storage:8333` tak terjangkau browser).
interface RecordedPut {
  method: string;
  path: string;
  contentType: string | undefined;
  hasAuthorization: boolean;
}

let server: Server;
let endpoint: string;
let puts: RecordedPut[] = [];

function record(req: IncomingMessage): void {
  puts.push({
    method: req.method ?? "",
    path: req.url ?? "",
    contentType: req.headers["content-type"],
    hasAuthorization: Boolean(req.headers.authorization),
  });
}

beforeAll(async () => {
  server = createServer((req, res) => {
    record(req);
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { ETag: '"fake-etag"' });
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  puts = [];
});

const build = (options: { endpoint?: string; publicBaseUrl?: string } = {}) =>
  new ObjectStorageService(options.endpoint ?? endpoint, "us-east-1", "audio-assets", "kunci", "rahasia", options.publicBaseUrl);

describe("ObjectStorageService.upload", () => {
  it("tanpa alamat publik: URL kembalian = endpoint/bucket/kunci (perilaku lama, dev lokal)", async () => {
    const url = await build().upload("audio/abc.mp3", Buffer.from("x"), "audio/mpeg");

    expect(url).toBe(`${endpoint}/audio-assets/audio/abc.mp3`);
  });

  it("garis miring di akhir endpoint tidak menghasilkan '//' pada URL kembalian", async () => {
    const url = await build({ endpoint: `${endpoint}/` }).upload("audio/abc.mp3", Buffer.from("x"), "audio/mpeg");

    expect(url).toBe(`${endpoint}/audio-assets/audio/abc.mp3`);
  });

  it("dengan alamat publik: URL kembalian memakainya (garis miring akhir dibuang), TANPA nama bucket di jalurnya", async () => {
    const url = await build({ publicBaseUrl: "https://app.contoh.id/media/" }).upload("audio/abc.mp3", Buffer.from("x"), "audio/mpeg");

    expect(url).toBe("https://app.contoh.id/media/audio/abc.mp3");
  });

  it("alamat publik hanya mengubah URL kembalian: objek tetap diunggah ke endpoint internal, path-style, dengan tipe & tanda tangan", async () => {
    await build({ publicBaseUrl: "https://app.contoh.id/media" }).upload("audio/abc.mp3", Buffer.from("isi audio"), "audio/mpeg");

    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ method: "PUT", path: expect.stringMatching(/^\/audio-assets\/audio\/abc\.mp3/), contentType: "audio/mpeg", hasAuthorization: true });
  });

  it("alamat publik kosong ('') diperlakukan sebagai tidak diisi (nilai .env kosong tidak merusak URL)", async () => {
    const url = await build({ publicBaseUrl: "" }).upload("audio/abc.mp3", Buffer.from("x"), "audio/mpeg");

    expect(url).toBe(`${endpoint}/audio-assets/audio/abc.mp3`);
  });
});
