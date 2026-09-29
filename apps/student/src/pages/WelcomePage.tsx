import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@elearning/ui";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";
import { useAuth } from "../auth/AuthContext";
import { INVALID_INPUT_TEXT, NETWORK_ERROR_TEXT, failureText, readFailure } from "../auth/api-errors";
import { AuthCard } from "../components/AuthCard";
import { XP_GOAL_OPTIONS, isXpGoal, type XpGoal } from "../lib/xp-goal";

type PathView = components["schemas"]["PathView"];
type PathState = PathView | "loading" | "failed";

const STEP_COUNT = 3;

const GOAL_COPY: Record<XpGoal, { label: string; description: string }> = {
  10: { label: "Santai", description: "Cocok kalau waktumu terbatas." },
  30: { label: "Reguler", description: "Target bawaan, seimbang untuk kebanyakan murid." },
  50: { label: "Serius", description: "Untuk kamu yang ingin cepat maju." },
};

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
    <p className="text-xs font-medium uppercase tracking-wide text-gray-500" data-testid="welcome-progress">
      Langkah {step} dari {STEP_COUNT}
    </p>
  );

  if (step === 1) {
    return (
      <AuthCard title={`Selamat datang, ${firstName}!`} width="lg">
        {progress}
        <p className="text-sm text-gray-600">
          Kamu bergabung di kelas <span className="font-medium text-gray-900">{me.className}</span>. Pertama, tentukan target
          belajarmu.
        </p>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-gray-700">Berapa XP yang ingin kamu kumpulkan tiap hari?</legend>
          {XP_GOAL_OPTIONS.map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                goal === value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="daily-goal"
                value={value}
                checked={goal === value}
                onChange={() => setGoal(value)}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-gray-900">
                  {value} XP -- {GOAL_COPY[value].label}
                </span>
                <span className="block text-gray-500">{GOAL_COPY[value].description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={saveGoalAndContinue} disabled={saving}>
            {saving ? "Menyimpan..." : "Lanjut"}
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (step === 2) {
    return (
      <AuthCard title="Jalur belajarmu" width="lg">
        {progress}
        {path === "loading" && <p className="text-sm text-gray-500">Memuat jalur belajarmu...</p>}
        {path === "failed" && <p className="text-sm text-gray-600">Jalur belajarmu akan tampil di Beranda.</p>}
        {path !== "loading" && path !== "failed" && (
          <>
            <p className="text-sm text-gray-600">
              Kamu mulai dari awal jalur, yaitu level <span className="font-medium text-gray-900">{startLevelName ?? "-"}</span>.
              Selesaikan pelajarannya berurutan untuk membuka yang berikutnya.
            </p>
            <ol className="space-y-2" data-testid="welcome-levels">
              {path.levels.map((level, index) => {
                const lessons = level.units.reduce((sum, unit) => sum + unit.totalLessons, 0);
                return (
                  <li
                    key={level.id}
                    className={`rounded-md border p-3 text-sm ${index === 0 ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
                  >
                    <span className="font-medium text-gray-900">{level.name}</span>
                    {index === 0 && <span className="ml-2 text-xs font-medium text-blue-700">mulai di sini</span>}
                    <span className="block text-gray-500">
                      {level.units.length} unit, {lessons} pelajaran
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => setStep(1)}>
            Kembali
          </Button>
          <Button onClick={() => setStep(3)}>Lanjut</Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Siap mulai!" width="lg">
      {progress}
      <dl className="space-y-2 rounded-md border border-gray-200 p-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Kelas</dt>
          <dd className="text-gray-900">{me.className}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Target harian</dt>
          <dd className="text-gray-900" data-testid="welcome-summary-goal">
            {goal} XP
          </dd>
        </div>
        {startLevelName && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Level awal</dt>
            <dd className="text-gray-900">{startLevelName}</dd>
          </div>
        )}
      </dl>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
        <li>Selesaikan pelajaran untuk mendapat XP.</li>
        <li>Belajar setiap hari supaya streak-mu terus bertambah.</li>
        <li>Target harian bisa kamu ubah kapan saja di halaman Profil.</li>
      </ul>
      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => setStep(2)}>
          Kembali
        </Button>
        <Button onClick={() => navigate("/", { replace: true })}>Mulai Belajar</Button>
      </div>
    </AuthCard>
  );
}
