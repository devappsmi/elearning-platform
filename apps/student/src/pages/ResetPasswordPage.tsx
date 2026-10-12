import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient, tokenStorage } from "../auth/api-client";
import { INVALID_INPUT_TEXT, NETWORK_ERROR_TEXT, failureText, readFailure } from "../auth/api-errors";
import { PASSWORD_HINT, newPasswordProblem } from "../auth/password-form";
import { AuthCard } from "../components/AuthCard";
import { TextField } from "../components/TextField";
import { Button, buttonClasses, textLinkClasses } from "../components/ui/Button";
import { Notice } from "../components/ui/Feedback";

export const PASSWORD_RESET_DONE_NOTICE = "Password berhasil diubah. Silakan masuk dengan password barumu.";

/** Reset password (AUTH-03) -- tujuan tautan di email lupa-password. Tidak ada
 * endpoint pra-cek token reset, jadi tautan yang kedaluwarsa/terpakai baru
 * ketahuan saat form dikirim: pada kasus itu halaman berganti ke pesan yang
 * jelas + tautan minta reset baru (bukan error mentah). Reset sukses mencabut
 * SEMUA sesi lama di server; token yang tersimpan di perangkat ini dibersihkan
 * juga supaya halaman Masuk tidak memantulkan murid ke sesi yang sudah mati. */
export function ResetPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tokenRejected, setTokenRejected] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = newPasswordProblem(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: apiError, response } = await apiClient.POST("/auth/reset", { body: { token, password } });
      if (data) {
        tokenStorage.clear();
        navigate("/login", { replace: true, state: { notice: PASSWORD_RESET_DONE_NOTICE } });
        return;
      }
      const failure = readFailure(response, apiError);
      // 400 dengan pesan string = token reset tidak valid/kedaluwarsa (validasi password
      // sudah dijaga di klien; kalau server tetap menolaknya, pesannya berupa array).
      if (failure.status === 400 && typeof failure.message === "string") {
        setTokenRejected(true);
      } else {
        setError(failureText(failure, INVALID_INPUT_TEXT));
      }
      setSubmitting(false);
    } catch {
      setError(NETWORK_ERROR_TEXT);
      setSubmitting(false);
    }
  }

  if (tokenRejected) {
    return (
      <AuthCard title="Tautan Reset Tidak Berlaku" emoji="⏰">
        <p className="text-sm font-semibold text-slate-600">
          Tautan ini sudah kedaluwarsa atau sudah dipakai. Tautan reset hanya berlaku 1 jam dan satu kali pakai.
        </p>
        <Link to="/forgot-password" className={buttonClasses({ block: true, size: "lg" })}>
          Minta Tautan Reset Baru
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Atur Ulang Password"
      emoji="🔐"
      footer={
        <Link to="/login" className={textLinkClasses}>
          Kembali ke halaman masuk
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          id="reset-password"
          label="Password baru"
          type="password"
          required
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          id="reset-password-confirmation"
          label="Konfirmasi password baru"
          type="password"
          required
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        {error && (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        )}
        <Button type="submit" disabled={submitting} block size="lg">
          {submitting ? "Menyimpan..." : "Simpan Password"}
        </Button>
      </form>
    </AuthCard>
  );
}
