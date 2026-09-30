import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { buttonClasses } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Confetti } from "../components/ui/Confetti";
import { Icon } from "../components/ui/icons";

type ScenarioAttemptResult = components["schemas"]["ScenarioAttemptResultDto"];

/** Hasil Percakapan (CONV-03/04) -- dibaca dari router state yang dikirim
 * ConversationPage setelah POST /scenarios/:id/attempts sukses, pola
 * identik LessonResultPage (bukan fetch terpisah, hasil attempt ephemeral).
 * `failed` (mode tes kehabisan kesempatan salah, lihat scenarioSession.ts)
 * ditampilkan BEDA dari sekadar "belum lulus" (accuracyPercent<80) --
 * pesannya lebih spesifik supaya murid tahu PERSIS kenapa sesi berhenti
 * di tengah jalan, bukan menduga-duga. */
export function ConversationResultPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const result = (location.state as { result?: ScenarioAttemptResult } | null)?.result;

  if (!result) return <Navigate to="/conversation" replace />;

  const tone = result.passed
    ? "bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600"
    : result.failed
      ? "bg-gradient-to-br from-orange-700 via-rose-700 to-pink-700"
      : "bg-gradient-to-br from-sky-600 via-indigo-600 to-violet-600";

  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      {result.passed && <Confetti />}

      <div className={`relative overflow-hidden rounded-[2rem] p-7 text-white shadow-glow motion-safe:animate-pop-in ${tone}`}>
        <p aria-hidden="true" className="relative text-6xl motion-safe:animate-float">
          {result.passed ? "🎉" : result.failed ? "😅" : "💪"}
        </p>
        <h1 className="relative mt-3 text-3xl font-black text-white">
          {result.passed ? "Lulus!" : result.failed ? "Kesempatan Habis" : "Belum Lulus"}
        </h1>
        {result.failed && !result.passed && (
          <p className="relative mt-2 text-sm font-bold text-white">
            Terlalu banyak jawaban salah -- sesi tes berhenti di tengah jalan.
          </p>
        )}
        {result.xpAwarded > 0 && (
          <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-4 py-1.5 text-lg font-black text-amber-950 shadow-lg">
            <Icon name="bolt" className="h-5 w-5" />+{result.xpAwarded} XP
          </p>
        )}
      </div>

      <Card tone="violet" padding="sm">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-violet-100">
            <dt className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Akurasi</dt>
            <dd className="mt-1 text-2xl font-black text-violet-800">{result.accuracyPercent}%</dd>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-violet-100">
            <dt className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Skor</dt>
            <dd className="mt-1 text-2xl font-black text-violet-800">{result.score}</dd>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-violet-100">
            <dt className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Jawaban salah</dt>
            <dd className="mt-1 text-2xl font-black text-rose-700">{result.mistakeCount}</dd>
          </div>
        </dl>
      </Card>

      <div className="flex flex-wrap justify-center gap-3">
        <Link to={`/conversation/${id}`} className={buttonClasses({ variant: "secondary", size: "lg" })}>
          <Icon name="refresh" className="h-5 w-5" />
          Coba Lagi
        </Link>
        <Link to="/conversation" className={buttonClasses({ size: "lg" })}>
          Daftar Skenario
        </Link>
      </div>
    </div>
  );
}
