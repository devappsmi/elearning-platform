import { vi } from "vitest";

/** Redis tiruan di memori untuk tes unit: hanya perintah yang dipakai alur auth
 * (lockout login, kuota reset password). Bukan pengganti Redis sungguhan --
 * perilaku atomik/kedaluwarsa asli diuji di infrastruktur nyata (docs/PLAN.md);
 * ini cukup untuk memeriksa KUNCI apa yang ditulis, urutan perintah, dan
 * semantik `SET ... NX`.
 *
 * `ttls` mencatat detik kedaluwarsa terakhir yang DIPASANG per kunci (lewat
 * `SET ... EX n` atau `EXPIRE`), supaya tes bisa memastikan kunci tidak pernah
 * dibiarkan tanpa TTL. Waktu tidak berjalan: kunci tidak pernah kedaluwarsa
 * sendiri. File `*.testkit.ts` dikecualikan dari build (tsconfig). */
export function createFakeRedis() {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();

  return {
    store,
    ttls,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    /** `set(key, value)` atau `set(key, value, "EX", detik)`, opsional `"NX"` (hanya bila kunci belum ada). */
    set: vi.fn(async (key: string, value: string | number, ...flags: Array<string | number>) => {
      if (flags.includes("NX") && store.has(key)) return null;
      store.set(key, String(value));
      const ex = flags.indexOf("EX");
      if (ex >= 0) ttls.set(key, Number(flags[ex + 1]));
      return "OK";
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: vi.fn(async (key: string, seconds: number) => {
      if (!store.has(key)) return 0;
      ttls.set(key, seconds);
      return 1;
    }),
    del: vi.fn(async (...keys: string[]) => {
      for (const key of keys) ttls.delete(key);
      return keys.filter((key) => store.delete(key)).length;
    }),
  };
}

export type FakeRedis = ReturnType<typeof createFakeRedis>;
