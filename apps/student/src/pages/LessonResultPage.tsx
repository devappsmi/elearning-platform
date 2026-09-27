import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@elearning/ui";
import type { components } from "@elearning/api-client";

type AttemptResultView = components["schemas"]["AttemptResultView"];

/** Hasil Belajar (S6 PRD) -- dibaca dari router state yang dikirim
 * LessonPage setelah POST /lessons/:id/attempts sukses (bukan fetch
 * terpisah -- hasil attempt itu sendiri tidak (belum) punya endpoint GET
 * tersendiri, ephemeral seperti hasil form submit). Refresh/navigasi
 * langsung ke URL ini tanpa state (mis. bookmark) ditangani jujur --
 * lempar balik ke Beranda, bukan coba tebak/render kosong. */
export function LessonResultPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const location = useLocation();
  const result = (location.state as { result?: AttemptResultView } | null)?.result;

  if (!result) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className={`rounded-lg border p-6 ${result.passed ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <p className="text-3xl">{result.passed ? "🎉" : "💪"}</p>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">{result.passed ? "Lulus!" : "Belum Lulus"}</h1>
        <p className="mt-1 text-sm text-gray-600">Akurasi: {result.accuracyPercent}%</p>
        {result.passed && <p className="mt-1 text-lg">{"⭐".repeat(result.stars)}</p>}
        {result.xpAwarded > 0 && <p className="mt-2 text-sm font-medium text-blue-700">+{result.xpAwarded} XP</p>}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 text-left text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Skor terbaik</span>
          <span className="font-medium text-gray-900">
            {result.bestScore}% ({"⭐".repeat(result.bestStars)})
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Jumlah percobaan</span>
          <span className="font-medium text-gray-900">{result.attempts}</span>
        </div>
      </div>

      <div className="flex justify-center gap-2">
        <Link to={`/learn/${lessonId}`}>
          <Button variant="secondary">Coba Lagi</Button>
        </Link>
        <Link to="/">
          <Button>Kembali ke Beranda</Button>
        </Link>
      </div>
    </div>
  );
}
