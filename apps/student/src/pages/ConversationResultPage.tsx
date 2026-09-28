import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@elearning/ui";
import type { components } from "@elearning/api-client";

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

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className={`rounded-lg border p-6 ${result.passed ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <p className="text-3xl">{result.passed ? "🎉" : result.failed ? "😅" : "💪"}</p>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">
          {result.passed ? "Lulus!" : result.failed ? "Kesempatan Habis" : "Belum Lulus"}
        </h1>
        {result.failed && !result.passed && (
          <p className="mt-1 text-sm text-gray-600">Terlalu banyak jawaban salah -- sesi tes berhenti di tengah jalan.</p>
        )}
        <p className="mt-1 text-sm text-gray-600">
          Akurasi: {result.accuracyPercent}% &middot; Skor: {result.score}
        </p>
        <p className="mt-1 text-sm text-gray-600">Jawaban salah: {result.mistakeCount}</p>
        {result.xpAwarded > 0 && <p className="mt-2 text-sm font-medium text-blue-700">+{result.xpAwarded} XP</p>}
      </div>

      <div className="flex justify-center gap-2">
        <Link to={`/conversation/${id}`}>
          <Button variant="secondary">Coba Lagi</Button>
        </Link>
        <Link to="/conversation">
          <Button>Daftar Skenario</Button>
        </Link>
      </div>
    </div>
  );
}
