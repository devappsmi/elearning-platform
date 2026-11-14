import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Urutan sistem berkas SUNGGUHAN yang dilakukan upload: tulis ke berkas sementara di direktori yang sama, BARU rename ke
// nama akhir. Itulah yang membuat pembaca tak pernah menerima berkas setengah jadi -- dan hal itu tidak bisa dibuktikan
// dari hasil akhirnya saja, jadi urutan panggilannya dicatat (fungsi aslinya tetap dijalankan).
const calls: string[] = [];

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
      calls.push(`writeFile ${String(args[0])}`);
      return actual.writeFile(...args);
    },
    rename: async (from: Parameters<typeof actual.rename>[0], to: Parameters<typeof actual.rename>[1]) => {
      calls.push(`rename ${String(from)} -> ${String(to)}`);
      return actual.rename(from, to);
    },
  };
});

const { LocalStorageService } = await import("./local-storage.service");

let root: string;
beforeEach(async () => {
  calls.length = 0;
  root = await mkdtemp(join(tmpdir(), "elearning-atomik-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("LocalStorageService -- penulisan atomik", () => {
  it("menulis HANYA ke berkas sementara (berawalan titik, di direktori yang sama) lalu me-rename ke nama akhir", async () => {
    await new LocalStorageService(root, "https://x.id/media").upload("audio/0123abcd.mp3", Buffer.from("isi"), "audio/mpeg");

    const [write, rename] = calls;
    expect(calls).toHaveLength(2);
    const temp = write!.replace("writeFile ", "");
    expect(temp).toMatch(new RegExp(`^${join(root, "audio")}/\\.[0-9a-f]{16}\\.tmp$`));
    expect(temp).not.toBe(join(root, "audio/0123abcd.mp3"));
    expect(rename).toBe(`rename ${temp} -> ${join(root, "audio/0123abcd.mp3")}`);
  });

  it("dua unggahan memakai dua berkas sementara yang berbeda (tak saling menimpa)", async () => {
    const storage = new LocalStorageService(root, "https://x.id/media");

    await Promise.all([storage.upload("audio/a.mp3", Buffer.from("1"), "audio/mpeg"), storage.upload("audio/a.mp3", Buffer.from("2"), "audio/mpeg")]);

    const temps = calls.filter((call) => call.startsWith("writeFile "));
    expect(new Set(temps).size).toBe(2);
  });
});
