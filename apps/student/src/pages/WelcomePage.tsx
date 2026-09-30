import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";
import { useAuth } from "../auth/AuthContext";
import { INVALID_INPUT_TEXT, NETWORK_ERROR_TEXT, failureText, readFailure } from "../auth/api-errors";
import { AuthCard } from "../components/AuthCard";
import { Button } from "../components/ui/Button";
import { Notice } from "../components/ui/Feedback";
import { Icon } from "../components/ui/icons";
import { XP_GOAL_OPTIONS, isXpGoal, type XpGoal } from "../lib/xp-goal";

type PathView = components["schemas"]["PathView"];
type PathState = PathView | "loading" | "failed";

const STEP_COUNT = 3;

const GOAL_COPY: Record<XpGoal, { label: string; description: string; emoji: string; tile: string }> = {
  10: { label: "Santai", description: "Cocok kalau waktumu terbatas.", emoji: "🌿", tile: "from-emerald-100 to-teal-100" },
  30: { label: "Reguler", description: "Target bawaan, seimbang untuk kebanyakan murid.", emoji: "🌟", tile: "from-amber-100 to-orange-100" },
  50: { label: "Serius", description: "Untuk kamu yang ingin cepat maju.", emoji: "🚀", tile: "from-pink-100 to-rose-100" },
};

// Emoji ubin level di langkah 2 (berulang bila levelnya lebih banyak).
const LEVEL_EMOJI = ["🌸", "🍙", "🗻", "🎏", "⛩️"] as const;

/** Onboarding singkat 3 layar setelah registrasi (PRD S3 `/welcome`: target
 * harian, level, mulai). Hanya menampilkan yang NYATA: target harian benar-benar
 * disimpan (PATCH /me), level awal dibaca dari jalur belajar kelasnya (GET /path).
 * Tes penempatan (AUTH-05, opsional) belum ada, jadi tidak ditawarkan di sini --
 * murid selalu mulai dari awal jalurnya. Halaman ini bisa dibuka lagi kapan saja
 * lewat /welcome; tidak ada penanda "sudah onboarding" di server. */
export function WelcomePage() {
  const { me, setMe } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<XpGoal>(isXpGoal(me.dailyXpGoal) ? me.dailyXpGoal : 30);
  const [path, setPath] = useState<PathState>("loading");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .GET("/path")
      .then(({ data }) => {
        if (!cancelled) setPath(data ?? "failed");
      })
      .catch(() => {
        if (!cancelled) setPath("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveGoalAndContinue() {
    setError(null);
    if (goal === me.dailyXpGoal) {
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      const { data, error: apiError, response } = await apiClient.PATCH("/me", { body: { dailyXpGoal: goal } });
      if (data) {
        setMe(data);
        setStep(2);
      } else {
        setError(failureText(readFailure(response, apiError), INVALID_INPUT_TEXT));
      }
    } catch {
      setError(NETWORK_ERROR_TEXT);
    } finally {
      setSaving(false);
    }
  }

  const firstName = me.name.trim().split(/\s+/)[0] || me.name;
  const firstLevel = path !== "loading" && path !== "failed" ? (path.levels[0] ?? null) : null;
  const startLevelName = firstLevel?.name ?? null;

  const progress = (
    <div className="space-y-2">
      <div aria-hidden="true" className="flex gap-2">
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
              i < step ? "bg-gradient-to-r from-primary-500 to-tertiary-500" : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="text-xs font-extrabold uppercase tracking-wider text-secondary-700" data-testid="welcome-progress">
        Langkah {step} dari {STEP_COUNT}
      </p>
    </div>
  );

  if (step === 1) {
    return (
      <AuthCard title={`Selamat datang, ${firstName}!`} width="lg" emoji="🎯">
        {progress}
        <p className="text-sm font-semibold text-slate-600">
          Kamu bergabung di kelas <span className="font-extrabold text-slate-900">{me.className}</span>. Pertama, tentukan
          target belajarmu.
        </p>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-extrabold text-slate-800">Berapa XP yang ingin kamu kumpulkan tiap hari?</legend>
          {XP_GOAL_OPTIONS.map((value) => {
            const copy = GOAL_COPY[value];
            const selected = goal === value;
            return (
              <label key={value} className="block cursor-pointer">
                <input
                  type="radio"
                  name="daily-goal"
                  value={value}
                  checked={selected}
                  onChange={() => setGoal(value)}
                  className="peer sr-only"
                />
                <span
                  className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition peer-focus-visible:ring-4 peer-focus-visible:ring-secondary-300 ${
                    selected
                      ? "border-secondary-500 bg-secondary-50 shadow-[0_4px_0_0_theme(colors.secondary.300)]"
                      : "border-slate-200 bg-white hover:border-secondary-300"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-2xl ${copy.tile}`}
                  >
                    {copy.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold text-slate-900">
                      {value} XP -- {copy.label}
                    </span>
                    <span className="block text-sm font-semibold text-slate-600">{copy.description}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${
                      selected ? "border-secondary-600 bg-secondary-600 text-white" : "border-slate-300 bg-white text-transparent"
                    }`}
                  >
                    <Icon name="check" className="h-4 w-4" strokeWidth={3.2} />
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {error && (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        )}
        <div className="flex justify-end">
          <Button onClick={saveGoalAndContinue} disabled={saving} size="lg">
            {saving ? "Menyimpan..." : "Lanjut"}
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (step === 2) {
    return (
      <AuthCard title="Jalur belajarmu" width="lg" emoji="🗺️">
        {progress}
        {path === "loading" && <p className="text-sm font-semibold text-slate-600">Memuat jalur belajarmu...</p>}
        {path === "failed" && (
          <p className="text-sm font-semibold text-slate-600">Jalur belajarmu akan tampil di Beranda.</p>
        )}
        {path !== "loading" && path !== "failed" && (
          <>
            <p className="text-sm font-semibold text-slate-600">
              Kamu mulai dari awal jalur, yaitu level <span className="font-extrabold text-slate-900">{startLevelName ?? "-"}</span>.
              Selesaikan pelajarannya berurutan untuk membuka yang berikutnya.
            </p>
            <ol className="space-y-3" data-testid="welcome-levels">
              {path.levels.map((level, index) => {
                const lessons = level.units.reduce((sum, unit) => sum + unit.totalLessons, 0);
                return (
                  <li
                    key={level.id}
                    className={`flex items-center gap-4 rounded-2xl border-2 p-4 ${
                      index === 0 ? "border-secondary-500 bg-secondary-50 shadow-[0_4px_0_0_theme(colors.secondary.300)]" : "border-slate-200 bg-white"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-secondary-100 to-tertiary-100 text-2xl"
                    >
                      {LEVEL_EMOJI[index % LEVEL_EMOJI.length]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-slate-900">{level.name}</span>
                        {index === 0 && (
                          <span className="rounded-full bg-secondary-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                            mulai di sini
                          </span>
                        )}
                      </span>
                      <span className="block text-sm font-semibold text-slate-600">
                        {level.units.length} unit, {lessons} pelajaran
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => setStep(1)} size="lg">
            Kembali
          </Button>
          <Button onClick={() => setStep(3)} size="lg">
            Lanjut
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Siap mulai!" width="lg" emoji="🚀">
      {progress}
      <dl className="divide-y divide-secondary-100 rounded-2xl border-2 border-secondary-100 bg-gradient-to-br from-secondary-50 to-tertiary-50 px-4 text-sm">
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="font-bold text-slate-600">Kelas</dt>
          <dd className="font-extrabold text-slate-900">{me.className}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="font-bold text-slate-600">Target harian</dt>
          <dd className="font-extrabold text-slate-900" data-testid="welcome-summary-goal">
            {goal} XP
          </dd>
        </div>
        {startLevelName && (
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="font-bold text-slate-600">Level awal</dt>
            <dd className="font-extrabold text-slate-900">{startLevelName}</dd>
          </div>
        )}
      </dl>
      <ul className="space-y-2 text-sm font-semibold text-slate-700">
        {[
          "Selesaikan pelajaran untuk mendapat XP.",
          "Belajar setiap hari supaya streak-mu terus bertambah.",
          "Target harian bisa kamu ubah kapan saja di halaman Profil.",
        ].map((tip) => (
          <li key={tip} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"
            >
              <Icon name="check" className="h-3 w-3" strokeWidth={3.4} />
            </span>
            {tip}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => setStep(2)} size="lg">
          Kembali
        </Button>
        <Button variant="sun" size="lg" onClick={() => navigate("/", { replace: true })}>
          Mulai Belajar
        </Button>
      </div>
    </AuthCard>
  );
}
