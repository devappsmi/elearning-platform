import { Navigate, Outlet } from "react-router-dom";

/**
 * STUB — there is no real AuthModule yet (backend auth endpoints don't
 * exist in this pass), so this only checks for a placeholder token in
 * localStorage. It does NOT validate/decode the token, refresh it, or
 * react to expiry. Replace with real token-refresh-aware logic once the
 * API's AuthModule exists and this app talks to `/auth/*` for real.
 */
export function AuthGuard() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
