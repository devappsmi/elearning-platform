import { vi } from "vitest";
import { apiClient } from "../auth/api-client";

/** Hasil satu panggilan API tiruan. `status` bawaan: 200 kalau ada `data`, selain itu 400. */
export interface MockResult {
  data?: unknown;
  error?: unknown;
  status?: number;
}

export type MockHandler = (input: { body?: unknown; params?: unknown }) => MockResult | Promise<MockResult>;
type Method = "GET" | "POST" | "PATCH";

/** Mengarahkan `apiClient.GET/POST/PATCH` ke handler per path. Pemakai HARUS sudah
 * memanggil `vi.mock("../auth/api-client", ...)` di file tesnya (vi.mock di-hoist,
 * tidak bisa dipindah ke helper). Path tanpa handler = kegagalan tes yang jelas,
 * bukan `undefined` diam-diam. Handler yang melempar mensimulasikan gangguan jaringan. */
export function mockApi(handlers: Partial<Record<Method, Record<string, MockHandler>>>): void {
  const dispatch =
    (method: Method) =>
    async (path: string, init?: { body?: unknown; params?: unknown }) => {
      const handler = handlers[method]?.[path];
      if (!handler) throw new Error(`Tes tidak menyediakan handler untuk ${method} ${path}`);
      const { data, error, status } = await handler(init ?? {});
      return { data, error, response: { status: status ?? (data === undefined ? 400 : 200) } as Response };
    };

  vi.mocked(apiClient.GET).mockImplementation(dispatch("GET") as never);
  vi.mocked(apiClient.POST).mockImplementation(dispatch("POST") as never);
  vi.mocked(apiClient.PATCH).mockImplementation(dispatch("PATCH") as never);
}

/** Jumlah panggilan ke `method path` -- untuk memastikan request TIDAK dikirim. */
export function callsTo(method: Method, path: string): unknown[][] {
  return vi.mocked(apiClient[method]).mock.calls.filter((call) => (call as unknown[])[0] === path) as unknown[][];
}
