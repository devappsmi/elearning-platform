import { Navigate, Outlet } from "react-router-dom";

/**
 * STUB — there is no real AdminAuthModule yet (backend auth endpoints
 * don't exist in this pass), so this only checks for a placeholder token
 * in localStorage. It does NOT validate/decode the token, refresh it, or
 * react to expiry. Replace with real token-refresh-aware logic once the
 * API's AdminAuthModule exists and this app talks to `/admin/auth/*` for
 * real.
 *
 * Namespaced as `admin_access_token` (distinct from the student app's
 * `access_token`) — student and admin auth are designed to be completely
 * separate per the plan, so a leaked student token must never work here.
 */
export function AuthGuard() {
  const token = localStorage.getItem("admin_access_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
