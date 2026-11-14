import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { buttonClasses } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Confetti } from "../components/ui/Confetti";
import { Icon } from "../components/ui/icons";

type AttemptResultView = components["schemas"]["AttemptResultView"];

/** Bintang hasil: `count` terisi (emas), sisanya pudar. Dibaca pembaca layar sebagai satu kalimat. */
function Stars({ count, total = 3, size = "h-10 w-10", animate }: { count: number; total?: number; size?: string; animate?: boolean }) {
  return (
    <span role="img" aria-label={`${count} dari ${total} bintang`} className="inline-flex justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <Icon
          key={i}
          name="star"
          className={`${size} ${i < count ? "text-amber-300 drop-shadow-[0_2px_6px_rgb(245_158_11_/_0.6)]" : "text-white/30"} ${
            animate && i < count ? "motion-safe:animate-pop-in" : ""
          }`}
          style={animate ? { animationDelay: `${0.25 + i * 0.18}s` } : undefined}
        />
      ))}
    </span>
  );
}

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
    <div className="mx-auto max-w-md space-y-5 text-center">
      {result.passed && <Confetti />}

      <div
        className={`relative overflow-hidden rounded-[2rem] p-7 text-white shadow-glow motion-safe:animate-pop-in ${
          result.passed
            ? "bg-gradient-to-br from-primary-600 via-secondary-600 to-tertiary-600"
            : "bg-gradient-to-br from-sky-600 via-primary-600 to-secondary-600"
        }`}
      >
        <span aria-hidden="true" className="pointer-events-none absolute -right-3 -top-8 select-none text-9xl font-black leading-none text-white/10">
          {result.passed ? "✓" : "…"}
        </span>
        <p aria-hidden="true" className="relative text-6xl motion-safe:animate-float">
          {result.passed ? "🎉" : "💪"}
        </p>
        <h1 className="relative mt-3 text-3xl font-black text-white">{result.passed ? "Lulus!" : "Belum Lulus"}</h1>
        <p className="relative mt-1 text-base font-bold text-white">Akurasi: {result.accuracyPercent}%</p>
        {result.passed && (
          <p className="relative mt-4">
            <Stars count={result.stars} animate />
          </p>
        )}
        {result.xpAwarded > 0 && (
          <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-4 py-1.5 text-lg font-black text-amber-950 shadow-lg">
            <Icon name="bolt" className="h-5 w-5" />+{result.xpAwarded} XP
          </p>
        )}
        {!result.passed && <p className="relative mt-4 text-sm font-bold text-white">Jangan menyerah, coba sekali lagi ya!</p>}
      </div>

      <Card tone="secondary" padding="sm" className="space-y-3 text-left text-sm font-bold text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>Skor terbaik</span>
          <span className="flex items-center gap-2 font-black text-slate-900">
            {result.bestScore}%
            <span className="rounded-full bg-secondary-600 px-2 py-0.5">
              <Stars count={result.bestStars} size="h-4 w-4" />
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-secondary-100 pt-3">
          <span>Jumlah percobaan</span>
          <span className="font-black text-slate-900">{result.attempts}</span>
        </div>
      </Card>

      <div className="flex flex-wrap justify-center gap-3">
        <Link to={`/learn/${lessonId}`} className={buttonClasses({ variant: "secondary", size: "lg" })}>
          <Icon name="refresh" className="h-5 w-5" />
          Coba Lagi
        </Link>
        <Link to="/" className={buttonClasses({ size: "lg" })}>
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
