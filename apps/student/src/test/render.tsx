import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, type MemoryRouterProps } from "react-router-dom";
import { AuthContext, type Me } from "../auth/AuthContext";

/** Halaman pengganti untuk rute TUJUAN navigasi: melaporkan path + state yang
 * diterimanya, supaya tes bisa memastikan ke mana (dan dengan pesan apa) halaman
 * yang diuji berpindah tanpa merender halaman tujuan sungguhan. */
function Destination() {
  const location = useLocation();
  return (
    <div>
      <p data-testid="destination-path">{location.pathname}</p>
      <p data-testid="destination-state">{JSON.stringify(location.state)}</p>
    </div>
  );
}

type Entry = NonNullable<MemoryRouterProps["initialEntries"]>[number];

export interface RenderPageOptions {
  /** Pola rute halaman yang diuji, mis. "/invite/:token". */
  path: string;
  /** URL awal, mis. "/invite/abc123" -- atau `{ pathname, state }` untuk halaman yang membaca location.state. */
  entry: Entry;
  /** Pola rute tujuan navigasi (masing-masing diganti halaman pengganti). */
  destinations?: string[];
}

export function renderPage(page: ReactNode, { path, entry, destinations = [] }: RenderPageOptions) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={path} element={page} />
        {destinations.map((destination) => (
          <Route key={destination} path={destination} element={<Destination />} />
        ))}
      </Routes>
    </MemoryRouter>,
  );
}

export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    id: "user-1",
    name: "Murid Baru",
    email: "murid@example.com",
    avatarUrl: null,
    classId: "class-1",
    className: "Kelas Hiragana Pagi",
    dailyXpGoal: 30,
    status: "ACTIVE",
    createdAt: "2026-01-15T00:00:00.000Z",
    lastActiveAt: null,
    ...overrides,
  };
}

/** Untuk halaman di bawah AuthGuard (Welcome, Profil): menyediakan AuthContext
 * tiruan. `setMe`/`logout` dikembalikan supaya tes bisa memeriksa pemanggilannya. */
export function renderAuthedPage(page: ReactNode, me: Me, options: RenderPageOptions) {
  const setMe = vi.fn();
  const logout = vi.fn();
  const view = renderPage(<AuthContext.Provider value={{ me, setMe, logout }}>{page}</AuthContext.Provider>, options);
  return { ...view, setMe, logout };
}
