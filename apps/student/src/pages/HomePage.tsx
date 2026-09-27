import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@elearning/ui";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";
import { useAuth } from "../auth/AuthContext";

type PathView = components["schemas"]["PathView"];

const LESSON_STYLE: Record<string, string> = {
  done: "border-green-200 bg-green-50 text-green-800 hover:bg-green-100",
  available: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
};

/** Beranda (S-home PRD) -- peta jalur belajar dari GET /path (LearningPathModule,
 * sudah ada+teruji sejak Milestone 7). Lesson terkunci dirender non-interaktif
 * (server tetap jadi penegak sesungguhnya lewat 403 di POST /lessons/:id/attempts,
 * lihat lessons.service.ts -- ini murni supaya murid tidak coba klik ke lesson
 * yang jelas belum waktunya). */
export function HomePage() {
  const { me } = useAuth();
  const [path, setPath] = useState<PathView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.GET("/path").then(({ data, error: apiError }) => {
      if (cancelled) return;
      if (apiError || !data) {
        setError("Gagal memuat jalur belajar.");
        return;
      }
      setPath(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!path) return <div className="p-6 text-sm text-gray-500">Memuat...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">
          Selamat datang, <span className="font-medium">{me.name}</span>
        </p>
        <p className="mt-1 text-sm text-gray-500">
          🔥 Streak: <span className="font-medium text-gray-900">{path.streak.current}</span> hari (terpanjang:{" "}
          {path.streak.longest})
        </p>
        {path.continueLessonId && (
          <Link to={`/learn/${path.continueLessonId}`} className="mt-3 inline-block">
            <Button>Lanjutkan Belajar</Button>
          </Link>
        )}
      </div>

      {path.levels.map((level) => (
        <div key={level.id}>
          <h2 className="text-lg font-semibold text-gray-900">{level.name}</h2>
          {level.units.map((unit) => (
            <div
              key={unit.id}
              className={`mt-3 rounded-lg border p-4 ${unit.unlocked ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50 opacity-60"}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{unit.title}</h3>
                <span className="text-xs text-gray-500">
                  {unit.completedLessons}/{unit.totalLessons}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {unit.lessons.map((lesson) =>
                  lesson.state === "locked" ? (
                    <span
                      key={lesson.id}
                      title="Terkunci"
                      className="rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-400"
                    >
                      🔒 {lesson.title}
                    </span>
                  ) : (
                    <Link
                      key={lesson.id}
                      to={`/learn/${lesson.id}`}
                      className={`rounded-md border px-3 py-2 text-sm ${LESSON_STYLE[lesson.state]}`}
                    >
                      {lesson.state === "done" ? `⭐${lesson.stars ?? 0} ` : ""}
                      {lesson.title}
                    </Link>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
