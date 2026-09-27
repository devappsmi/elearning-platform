import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@elearning/ui";
import { apiClient, tokenStorage } from "../auth/api-client";

/** Login murid SUNGGUHAN -- panggil POST /auth/login asli (Milestone 10,
 * lihat docs/PLAN.md). Kalau sudah ada token tersimpan, tidak perlu
 * render form ini -- lempar ke halaman utama, AuthGuard yang menentukan
 * valid/tidaknya. */
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (tokenStorage.getAccessToken() || tokenStorage.getRefreshToken()) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error: apiError } = await apiClient.POST("/auth/login", { body: { email, password } });
    setSubmitting(false);
    if (apiError || !data) {
      setError("Email atau password salah.");
      return;
    }
    tokenStorage.setTokens(data);
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Masuk</h1>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Memproses..." : "Masuk"}
        </Button>
      </form>
    </div>
  );
}
