import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { apiClient, tokenStorage } from "../auth/api-client";
import { INVALID_INPUT_TEXT, NETWORK_ERROR_TEXT, failureText, readFailure } from "../auth/api-errors";
import { PASSWORD_HINT, newPasswordProblem } from "../auth/password-form";
import { AuthCard } from "../components/AuthCard";
import { TextField } from "../components/TextField";
import { Button, buttonClasses, textLinkClasses } from "../components/ui/Button";
import { Notice } from "../components/ui/Feedback";

type InvitationCheck = components["schemas"]["InvitationCheckDto"];
type UnusableReason = Exclude<InvitationCheck["reason"], "VALID">;

interface InvitationDetails {
  name: string;
  email: string;
  className: string;
  institutionName: string | null;
}

type PageState =
  | { status: "checking" }
  | { status: "ready"; invitation: InvitationDetails }
  | { status: "unusable"; reason: UnusableReason }
  | { status: "unreachable" };

async function checkInvitation(token: string): Promise<PageState> {
  try {
    const { data } = await apiClient.POST("/auth/invitations/validate", { body: { token } });
    if (!data) return { status: "unreachable" };
    if (data.reason !== "VALID") return { status: "unusable", reason: data.reason };
    // Server selalu mengisi detail saat VALID; kalau tidak, jangan tampilkan form setengah kosong.
    if (data.name === undefined || data.email === undefined || data.className === undefined) return { status: "unreachable" };
    return {
      status: "ready",
      invitation: { name: data.name, email: data.email, className: data.className, institutionName: data.institutionName ?? null },
    };
  } catch {
    return { status: "unreachable" };
  }
}

/** Halaman undangan (PRD S1, AUTH-02) -- tujuan tautan di email undangan.
 * Memeriksa token ke server lebih dulu: token VALID menampilkan form
 * registrasi (email terkunci dari undangan, nama, password + konfirmasi);
 * token tak berlaku menampilkan halaman error yang sesuai. Registrasi sukses =
 * auto-login lalu onboarding (/welcome). `classId`/`email` TIDAK dikirim dari
 * sini -- server mengambilnya dari undangan (lihat AuthService.register). */
export function AcceptInvitationPage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<PageState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "checking" });
    checkInvitation(token).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  async function recheck() {
    const next = await checkInvitation(token);
    if (next.status !== "ready") setState(next);
  }

  if (state.status === "checking") {
    return (
      <AuthCard title="Undangan" emoji="💌">
        <p className="text-sm font-semibold text-slate-600">Memeriksa undangan...</p>
      </AuthCard>
    );
  }

  if (state.status === "unreachable") {
    return (
      <AuthCard title="Undangan" emoji="💌">
        <Notice tone="error" role="alert">
          {NETWORK_ERROR_TEXT}
        </Notice>
        <Button onClick={() => setAttempt((n) => n + 1)}>Coba Lagi</Button>
      </AuthCard>
    );
  }

  if (state.status === "unusable") return <UnusableInvitation reason={state.reason} token={token} />;

  return <RegistrationForm token={token} invitation={state.invitation} onTokenRejected={recheck} />;
}

function RegistrationForm({
  token,
  invitation,
  onTokenRejected,
}: {
  token: string;
  invitation: InvitationDetails;
  onTokenRejected: () => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState(invitation.name);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError("Nama lengkap wajib diisi.");
      return;
    }
    const problem = newPasswordProblem(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: apiError, response } = await apiClient.POST("/auth/register", {
        body: { token, name: trimmedName, password },
      });
      if (data) {
        tokenStorage.setTokens(data);
        navigate("/welcome", { replace: true });
        return;
      }
      const failure = readFailure(response, apiError);
      setError(failureText(failure, INVALID_INPUT_TEXT));
      setSubmitting(false);
      // Pesan bisnis 400 (string) pada registrasi = keadaan undangan berubah sejak
      // halaman dibuka (kedaluwarsa/dicabut/dipakai) -- periksa ulang supaya
      // murid melihat halaman yang sesuai, bukan form yang pasti gagal lagi.
      if (failure.status === 400 && typeof failure.message === "string") onTokenRejected();
    } catch {
      setError(NETWORK_ERROR_TEXT);
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title={invitation.institutionName ? `Selamat datang di ${invitation.institutionName}` : "Selamat datang"}
      width="md"
      emoji="🎉"
      footer={
        <>
          Sudah punya akun?{" "}
          <Link to="/login" className={textLinkClasses}>
            Masuk
          </Link>
        </>
      }
    >
      <p className="text-sm font-semibold text-slate-600">
        Kamu diundang bergabung di kelas <span className="font-extrabold text-slate-900">{invitation.className}</span>. Lengkapi
        data berikut untuk membuat akunmu.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField id="invite-name" label="Nama lengkap" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          id="invite-email"
          label="Email"
          type="email"
          readOnly
          value={invitation.email}
          hint="Email terkunci sesuai undangan."
        />
        <TextField
          id="invite-password"
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          id="invite-password-confirmation"
          label="Konfirmasi password"
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
          {submitting ? "Memproses..." : "Buat Akun"}
        </Button>
      </form>
    </AuthCard>
  );
}

const UNUSABLE_COPY: Record<UnusableReason, { title: string; body: string; emoji: string }> = {
  NOT_FOUND: {
    emoji: "🔎",
    title: "Tautan undangan tidak valid",
    body: "Tautan ini tidak dikenali. Pastikan kamu membuka tautan lengkap dari email undangan. Kalau kamu menerima undangan yang lebih baru, pakai tautan pada email terbaru itu. Atau hubungi admin lembaga kamu.",
  },
  EXPIRED: {
    emoji: "⏰",
    title: "Undangan sudah kedaluwarsa",
    body: "Masa berlaku undangan ini sudah habis. Kamu bisa meminta undangan baru -- admin lembaga kamu akan diberi tahu.",
  },
  REVOKED: {
    emoji: "🚫",
    title: "Undangan sudah dicabut",
    body: "Undangan ini dicabut oleh admin. Hubungi admin lembaga kamu kalau ini keliru.",
  },
  ALREADY_ACCEPTED: {
    emoji: "✅",
    title: "Undangan sudah dipakai",
    body: "Akun untuk undangan ini sudah dibuat. Silakan masuk dengan email dan password yang kamu buat.",
  },
};

type ResendState = { status: "idle" } | { status: "sending" } | { status: "sent" } | { status: "failed"; text: string };

function UnusableInvitation({ reason, token }: { reason: UnusableReason; token: string }) {
  const [resend, setResend] = useState<ResendState>({ status: "idle" });
  const copy = UNUSABLE_COPY[reason];

  // Tombol "Minta undangan ulang" (AC AUTH-02) hanya untuk token KEDALUWARSA: untuk
  // token yang tidak dikenal server tidak tahu siapa yang harus dinotifikasi
  // (endpoint-nya diam-diam tidak melakukan apa-apa), dan undangan yang dicabut
  // memang sengaja dicabut admin -- tombol di dua kasus itu akan menyesatkan.
  async function requestResend() {
    setResend({ status: "sending" });
    try {
      const { data, error, response } = await apiClient.POST("/auth/invitations/{token}/request-resend", {
        params: { path: { token } },
      });
      if (data) {
        setResend({ status: "sent" });
        return;
      }
      setResend({ status: "failed", text: failureText(readFailure(response, error), "Gagal mengirim permintaan. Coba lagi nanti.") });
    } catch {
      setResend({ status: "failed", text: NETWORK_ERROR_TEXT });
    }
  }

  return (
    <AuthCard
      title={copy.title}
      width="md"
      emoji={copy.emoji}
      footer={
        <>
          Sudah punya akun?{" "}
          <Link to="/login" className={textLinkClasses}>
            Masuk
          </Link>
        </>
      }
    >
      <p className="text-sm font-semibold text-slate-600">{copy.body}</p>

      {reason === "EXPIRED" && resend.status !== "sent" && (
        <Button onClick={requestResend} disabled={resend.status === "sending"}>
          {resend.status === "sending" ? "Mengirim..." : "Minta undangan ulang"}
        </Button>
      )}
      {resend.status === "sent" && (
        <Notice tone="success" role="status">
          Permintaan sudah diteruskan ke admin lembaga kamu. Setelah undangan baru dikirim, cek emailmu.
        </Notice>
      )}
      {resend.status === "failed" && (
        <Notice tone="error" role="alert">
          {resend.text}
        </Notice>
      )}

      {reason === "ALREADY_ACCEPTED" && (
        <Link to="/login" className={buttonClasses({ block: true, size: "lg" })}>
          Masuk
        </Link>
      )}
    </AuthCard>
  );
}
