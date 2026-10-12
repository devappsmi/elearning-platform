import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./generated/schema";
import type { TokenPair, TokenStorage } from "./token-storage";

export interface CreateApiClientOptions {
  baseUrl: string;
  tokenStorage: TokenStorage;
  /** `/auth/refresh` untuk murid, `/admin/auth/refresh` untuk admin -- dua
   * endpoint beda dengan secret JWT beda (lihat plan "Auth student vs
   * admin benar-benar terpisah"), jadi tidak bisa di-hardcode di sini. */
  refreshPath: "/auth/refresh" | "/admin/auth/refresh";
  /** Dipanggil begitu refresh token TERNYATA juga tidak valid lagi (butuh
   * login ulang sungguhan) -- client ini tidak tahu apa-apa soal routing,
   * app (AuthGuard/router) yang mutuskan mau redirect ke mana. */
  onUnauthenticated?: () => void;
}

/** Client REST bertipe penuh dari skema OpenAPI ter-generate
 * (`generated/schema.ts`, lihat package.json "generate") -- dipakai
 * `apps/student` DAN `apps/admin`, dibedakan lewat `tokenStorage`/
 * `refreshPath` per instance (masing-masing app panggil `createApiClient`
 * sendiri dengan config beda, lihat auth/api-client.ts di tiap app). */
export function createApiClient({ baseUrl, tokenStorage, refreshPath, onUnauthenticated }: CreateApiClientOptions): Client<paths> {
  const client = createClient<paths>({ baseUrl });

  // Clone request MENTAH (belum di-fetch, body belum "dipakai") disimpan di
  // sini saat onRequest, supaya masih bisa dipakai ulang di onResponse kalau
  // perlu retry -- Request yang sampai di onResponse body-nya SUDAH
  // dikonsumsi fetch asli (Request adalah stream sekali-pakai), jadi tidak
  // bisa di-clone lagi di titik itu. clone() HARUS dipanggil sebelum itu.
  const pendingClones = new Map<string, Request>();

  // Refresh token di server itu ROTATE-ON-USE + deteksi-reuse (lihat
  // AuthService.refresh): dua panggilan refresh PARALEL dengan refresh
  // token yang SAMA akan membuat salah satunya dianggap "reuse" dan
  // me-revoke SELURUH chain, memaksa re-login walau sesi user sebenarnya
  // masih valid. Jadi SEMUA 401 yang terjadi bersamaan (mis. beberapa GET
  // paralel pas access token baru kedaluwarsa) WAJIB berbagi SATU promise
  // refresh, bukan masing-masing manggil endpoint refresh sendiri-sendiri.
  let refreshPromise: Promise<boolean> | null = null;

  async function doRefresh(): Promise<boolean> {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) return false;
    try {
      // new Request(...) eksplisit (BUKAN fetch(urlString, init)) SENGAJA --
      // supaya SEMUA panggilan fetch() dari client ini (request asli lewat
      // openapi-fetch, refresh di sini, retry di bawah) selalu menerima
      // objek Request yang genuine, bentuk input yang konsisten/seragam.
      const res = await fetch(
        new Request(`${baseUrl}${refreshPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        }),
      );
      if (!res.ok) return false;
      const pair = (await res.json()) as TokenPair;
      tokenStorage.setTokens(pair);
      return true;
    } catch {
      return false;
    }
  }

  client.use({
    onRequest({ request, id }) {
      const accessToken = tokenStorage.getAccessToken();
      if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
      pendingClones.set(id, request.clone());
      return request;
    },
    async onResponse({ response, id }) {
      const clone = pendingClones.get(id);
      pendingClones.delete(id);

      if (response.status !== 401 || !clone) return response;

      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;

      if (!refreshed) {
        tokenStorage.clear();
        onUnauthenticated?.();
        return response;
      }

      // Retry lewat fetch() mentah (BUKAN client.GET/... lagi) -- sengaja,
      // supaya tidak lewat middleware ini lagi sama sekali (tidak ada
      // risiko retry-loop kalau server entah kenapa tetap balas 401).
      const accessToken = tokenStorage.getAccessToken();
      if (accessToken) clone.headers.set("Authorization", `Bearer ${accessToken}`);
      return fetch(clone);
    },
  });

  return client;
}
