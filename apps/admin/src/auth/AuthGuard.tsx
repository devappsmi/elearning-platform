import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { apiClient, tokenStorage } from "./api-client";
import { AuthContext, type Me } from "./AuthContext";

type GuardState = { status: "checking" } | { status: "unauthenticated" } | { status: "authenticated"; me: Me };

/**
 * BUKAN cuma cek localStorage kosong/tidak (seperti stub sebelum pass ini) --
 * panggil GET /admin/auth/me SUNGGUHAN (endpoint baru Milestone 10 lanjutan,
 * lihat admin-auth.controller.ts). Persis pola AuthGuard apps/student --
 * lihat catatan lengkap di sana. */
export function AuthGuard() {
  const [state, setState] = useState<GuardState>({ status: "checking" });
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    if (!tokenStorage.getAccessToken() && !tokenStorage.getRefreshToken()) {
      setState({ status: "unauthenticated" });
      return;
    }
    apiClient.GET("/admin/auth/me").then(({ data, error }) => {
      if (cancelled) return;
      setState(error || !data ? { status: "unauthenticated" } : { status: "authenticated", me: data });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "checking") {
    return <div className="p-6 text-sm text-gray-500">Memuat...</div>;
  }

  if (state.status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  function logout() {
    tokenStorage.clear();
    setState({ status: "unauthenticated" });
  }

  return (
    <AuthContext.Provider value={{ me: state.me, logout }}>
      <Outlet />
    </AuthContext.Provider>
  );
}
