import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@elearning/ui";
import { apiClient, tokenStorage } from "../auth/api-client";
import { NETWORK_ERROR_TEXT, failureText, readFailure, type ApiFailure } from "../auth/api-errors";
import { AuthCard } from "../components/AuthCard";
import { TextField } from "../components/TextField";

interface LoginLocationState {
  from?: string;
  /** Pesan sekali-tampil dari halaman lain (mis. sesudah reset password berhasil). */
  notice?: string;
}

export const INVALID_CREDENTIALS_TEXT = "Email atau password salah.";

/** Teks kegagalan masuk. 403 dari /auth/login HANYA berasal dari kunci login (5x
 * salah -> 15 menit) dan pesannya sudah berbahasa Indonesia serta menyebut
 * lamanya -- diteruskan apa adanya. Kalau tidak, murid yang sedang terkunci
 * melihat "password salah" padahal password-nya benar, lalu terus mencoba.
 * 429/5xx memakai teks bersama; sisanya berarti kredensial salah. */
function loginFailureText(failure: ApiFailure): string {
  if (failure.status === 403 && typeof failure.message === "string") return failure.message;
  return failureText(failure, INVALID_CREDENTIALS_TEXT);
}

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
  const locationState = (location.state ?? null) as LoginLocationState | null;

  if (tokenStorage.getAccessToken() || tokenStorage.getRefreshToken()) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: apiError, response } = await apiClient.POST("/auth/login", { body: { email, password } });
      setSubmitting(false);
      if (data) {
        tokenStorage.setTokens(data);
        navigate(locationState?.from ?? "/", { replace: true });
        return;
      }
      setError(loginFailureText(readFailure(response, apiError)));
    } catch {
      // Gangguan jaringan melempar (bukan `{ error }`) -- tanpa ini tombol macet di "Memproses...".
      setSubmitting(false);
      setError(NETWORK_ERROR_TEXT);
    }
  }

  return (
    <AuthCard title="Masuk">
      {locationState?.notice && (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {locationState.notice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Memproses..." : "Masuk"}
        </Button>
      </form>

      <p className="text-center text-sm">
        <Link to="/forgot-password" className="font-medium text-blue-600 hover:underline">
          Lupa password?
        </Link>
      </p>
    </AuthCard>
  );
}
