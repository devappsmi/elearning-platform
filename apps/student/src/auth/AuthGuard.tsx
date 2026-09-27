import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { apiClient, tokenStorage } from "./api-client";
import { AuthContext, type Me } from "./AuthContext";

type GuardState = { status: "checking" } | { status: "unauthenticated" } | { status: "authenticated"; me: Me };

/**
 * BUKAN cuma cek localStorage kosong/tidak (seperti stub sebelum pass ini) --
 * panggil GET /me SUNGGUHAN. Dua alasan: (1) membuktikan access token yang
 * tersimpan benar-benar masih valid di server (bukan cuma "ada string di
 * localStorage" -- token yang di-revoke, mis. lewat reset password di
 * device lain, sekarang ke-detect); (2) kalau access token basi tapi
 * refresh token masih hidup, request ini otomatis lewat jalur
 * refresh-lalu-retry di createApiClient (packages/api-client) -- murid TIDAK
 * dilempar ke /login cuma karena access token 1 jam-nya kedaluwarsa selagi
 * mereka idle, selama refresh token 14 hari-nya masih valid.
 */
export function AuthGuard() {
  const [state, setState] = useState<GuardState>({ status: "checking" });
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    if (!tokenStorage.getAccessToken() && !tokenStorage.getRefreshToken()) {
      setState({ status: "unauthenticated" });
      return;
    }
    apiClient.GET("/me").then(({ data, error }) => {
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
