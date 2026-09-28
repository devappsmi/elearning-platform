import { createContext, useContext } from "react";
import type { components } from "@elearning/api-client";

export type Me = components["schemas"]["MeDto"];

export interface AuthContextValue {
  me: Me;
  logout: () => void;
  // Dipanggil ProfilePage setelah PATCH /me sukses -- supaya nav ("Halo,
  // {nama}") dan halaman lain yang baca `me` dari context langsung
  // konsisten TANPA reload, bukan cuma halaman profil sendiri yang update.
  setMe: (me: Me) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Cuma valid dipanggil dari komponen di BAWAH AuthGuard (lihat router.tsx)
 * -- AuthGuard adalah satu-satunya Provider, dan cuma me-render children-nya
 * begitu status sudah "authenticated". */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() dipanggil di luar AuthGuard");
  return ctx;
}
