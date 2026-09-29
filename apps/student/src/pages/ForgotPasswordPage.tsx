import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@elearning/ui";
import { apiClient } from "../auth/api-client";
import { INVALID_INPUT_TEXT, NETWORK_ERROR_TEXT, failureText, readFailure } from "../auth/api-errors";
import { AuthCard } from "../components/AuthCard";
import { TextField } from "../components/TextField";

/** Lupa password (AUTH-03): kirim tautan reset yang berlaku 1 jam. Server SELALU
 * menjawab sukses, ada atau tidak akunnya (tidak membocorkan email mana yang
 * terdaftar) -- karena itu layar "terkirim" di sini sengaja berbunyi bersyarat
 * ("kalau email terdaftar"), sama untuk semua email. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
      setError("Email wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: apiError, response } = await apiClient.POST("/auth/forgot", { body: { email: trimmedEmail } });
      if (data) {
        setSent(true);
      } else {
        const failure = readFailure(response, apiError);
        // Server menolak (400) HANYA untuk email yang bentuknya salah -- pesan validasinya
        // berbahasa Inggris, jadi diganti teks yang jelas di sini.
        setError(failure.status === 400 ? "Format email tidak valid." : failureText(failure, INVALID_INPUT_TEXT));
      }
    } catch {
      setError(NETWORK_ERROR_TEXT);
    } finally {
      setSubmitting(false);
    }
  }

  const backToLogin = (
    <Link to="/login" className="font-medium text-blue-600 hover:underline">
      Kembali ke halaman masuk
    </Link>
  );

  if (sent) {
    return (
      <AuthCard title="Cek Emailmu" footer={backToLogin}>
        <p role="status" className="text-sm text-gray-700">
          Kalau <span className="font-medium">{email.trim()}</span> terdaftar, kami sudah mengirim tautan untuk mengatur ulang
          password. Tautannya berlaku 1 jam.
        </p>
        <p className="text-sm text-gray-500">Tidak ada email masuk? Periksa juga folder spam.</p>
        <Button variant="secondary" onClick={() => setSent(false)}>
          Kirim ke email lain
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Lupa Password" footer={backToLogin}>
      <p className="text-sm text-gray-600">Masukkan email akunmu. Kami akan mengirim tautan untuk mengatur ulang password.</p>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          id="forgot-email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Mengirim..." : "Kirim Tautan Reset"}
        </Button>
      </form>
    </AuthCard>
  );
}
