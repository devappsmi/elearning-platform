import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";
import type { TokenPair, TokenStorage } from "./token-storage";

const BASE_URL = "http://api.test";

function fakeTokenStorage(initial: { access?: string; refresh?: string } = {}) {
  let access: string | null = initial.access ?? null;
  let refresh: string | null = initial.refresh ?? null;
  const storage: TokenStorage & { dump(): { access: string | null; refresh: string | null } } = {
    getAccessToken: () => access,
    getRefreshToken: () => refresh,
    setTokens: (pair: TokenPair) => {
      access = pair.accessToken;
      refresh = pair.refreshToken;
    },
    clear: () => {
      access = null;
      refresh = null;
    },
    dump: () => ({ access, refresh }),
  };
  return storage;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createApiClient", () => {
  it("attaches the stored access token as a Bearer header", async () => {
    const storage = fakeTokenStorage({ access: "at-1", refresh: "rt-1" });
    const fetchMock = vi.fn(async (req: Request) => {
      expect(req.headers.get("Authorization")).toBe("Bearer at-1");
      return jsonResponse({ id: "u1" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({ baseUrl: BASE_URL, tokenStorage: storage, refreshPath: "/auth/refresh" });
    const { data, error } = await client.GET("/me");

    expect(error).toBeUndefined();
    expect(data).toEqual({ id: "u1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("on 401, refreshes once via refreshPath and retries the SAME original request", async () => {
    const storage = fakeTokenStorage({ access: "expired", refresh: "rt-1" });
    let meCalls = 0;
    let refreshCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (req: Request) => {
        const path = new URL(req.url).pathname;
        if (path === "/auth/refresh") {
          refreshCalls++;
          expect(JSON.parse(await req.text())).toEqual({ refreshToken: "rt-1" });
          return jsonResponse({ accessToken: "fresh", refreshToken: "rt-2" });
        }
        if (path === "/me") {
          meCalls++;
          if (meCalls === 1) {
            expect(req.headers.get("Authorization")).toBe("Bearer expired");
            return new Response(null, { status: 401 });
          }
          // Retry harus request yang SAMA (method/url) dengan token BARU --
          // bukan request baru yang dibentuk ulang dari nol.
          expect(req.method).toBe("GET");
          expect(new URL(req.url).pathname).toBe("/me");
          expect(req.headers.get("Authorization")).toBe("Bearer fresh");
          return jsonResponse({ id: "u1" });
        }
        throw new Error(`unexpected fetch to ${path}`);
      }),
    );

    const client = createApiClient({ baseUrl: BASE_URL, tokenStorage: storage, refreshPath: "/auth/refresh" });
    const { data, error } = await client.GET("/me");

    expect(error).toBeUndefined();
    expect(data).toEqual({ id: "u1" });
    expect(meCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(storage.dump()).toEqual({ access: "fresh", refresh: "rt-2" });
  });

  it("retries a POST request WITH its original JSON body intact after refresh", async () => {
    const storage = fakeTokenStorage({ access: "expired", refresh: "rt-1" });
    let reviewCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (req: Request) => {
        const path = new URL(req.url).pathname;
        if (path === "/auth/refresh") {
          return jsonResponse({ accessToken: "fresh", refreshToken: "rt-2" });
        }
        if (path === "/flashcards/review") {
          reviewCalls++;
          const body = JSON.parse(await req.text());
          expect(body).toEqual({ itemId: "voc_1", correct: true });
          if (reviewCalls === 1) return new Response(null, { status: 401 });
          expect(req.headers.get("Authorization")).toBe("Bearer fresh");
          return jsonResponse({ ok: true });
        }
        throw new Error(`unexpected fetch to ${path}`);
      }),
    );

    const client = createApiClient({ baseUrl: BASE_URL, tokenStorage: storage, refreshPath: "/auth/refresh" });
    const { response } = await client.POST("/flashcards/review", { body: { itemId: "voc_1", correct: true } });

    expect(reviewCalls).toBe(2);
    expect(response.status).toBe(200);
  });

  it("dedupes concurrent 401s into a SINGLE refresh call (refresh token is rotate-on-use)", async () => {
    const storage = fakeTokenStorage({ access: "expired", refresh: "rt-1" });
    let meCalls = 0;
    let refreshCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (req: Request) => {
        const path = new URL(req.url).pathname;
        if (path === "/auth/refresh") {
          refreshCalls++;
          return jsonResponse({ accessToken: "fresh", refreshToken: "rt-2" });
        }
        if (path === "/me") {
          meCalls++;
          // Dua panggilan PERTAMA (paralel) 401 bersamaan; sisanya (retry) sukses.
          if (meCalls <= 2) return new Response(null, { status: 401 });
          return jsonResponse({ id: "u1" });
        }
        throw new Error(`unexpected fetch to ${path}`);
      }),
    );

    const client = createApiClient({ baseUrl: BASE_URL, tokenStorage: storage, refreshPath: "/auth/refresh" });
    const [a, b] = await Promise.all([client.GET("/me"), client.GET("/me")]);

    expect(a.data).toEqual({ id: "u1" });
    expect(b.data).toEqual({ id: "u1" });
    expect(refreshCalls).toBe(1);
    expect(meCalls).toBe(4);
  });

  it("when refresh itself fails, clears tokens and calls onUnauthenticated without retrying", async () => {
    const storage = fakeTokenStorage({ access: "expired", refresh: "stale" });
    let meCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (req: Request) => {
        const path = new URL(req.url).pathname;
        if (path === "/auth/refresh") return new Response(null, { status: 401 });
        if (path === "/me") {
          meCalls++;
          return new Response(null, { status: 401 });
        }
        throw new Error(`unexpected fetch to ${path}`);
      }),
    );

    const onUnauthenticated = vi.fn();
    const client = createApiClient({
      baseUrl: BASE_URL,
      tokenStorage: storage,
      refreshPath: "/auth/refresh",
      onUnauthenticated,
    });
    const { response } = await client.GET("/me");

    // Response 401 tanpa body sungguhan berarti body kosong ("", bukan
    // undefined) -- dikonfirmasi langsung: `new Response(null, {status:401})`
    // TIDAK auto-set Content-Length, jadi openapi-fetch jatuh ke jalur
    // response.text() (bukan early-return jalur Content-Length==="0").
    expect(response.status).toBe(401);
    expect(meCalls).toBe(1); // TIDAK retry -- refresh gagal, bukan diam-diam infinite-loop
    expect(storage.dump()).toEqual({ access: null, refresh: null });
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("does not attempt refresh when there is no stored refresh token at all", async () => {
    const storage = fakeTokenStorage(); // belum pernah login
    const fetchMock = vi.fn(async (req: Request) => {
      expect(new URL(req.url).pathname).toBe("/me");
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const onUnauthenticated = vi.fn();
    const client = createApiClient({ baseUrl: BASE_URL, tokenStorage: storage, refreshPath: "/auth/refresh", onUnauthenticated });
    await client.GET("/me");

    expect(fetchMock).toHaveBeenCalledTimes(1); // tidak pernah coba panggil /auth/refresh
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });
});
