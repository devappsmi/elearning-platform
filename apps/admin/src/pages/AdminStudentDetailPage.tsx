import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { Button } from "@elearning/ui";
import { apiClient } from "../auth/api-client";

type StudentDetail = components["schemas"]["StudentDetailDto"];
type StudentProgress = components["schemas"]["StudentProgressDto"];
type ClassListItem = components["schemas"]["ClassListItemDto"];
type XpSource = StudentProgress["recentActivity"][number]["source"];

const SOURCE_LABEL: Record<XpSource, string> = {
  LESSON: "Lesson",
  CHECKPOINT: "Checkpoint",
  SCENARIO: "Percakapan",
  DAILY_QUIZ: "Kuis Harian",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

/** Detail Murid (ADM-31) -- profil+aksi (pindah kelas, aktifkan/nonaktifkan,
 * reset password) di atas, lalu statistik belajar (level/XP/streak, progres
 * per unit, skor percakapan, aktivitas 90 hari) di bawah. `scenarioProgress`
 * BARU tersedia dari backend sesi ini (dulu gap tercatat di docs/PLAN.md
 * bagian 6c, ScenarioAttempt sudah ada sejak Milestone 9 lanjutan tapi
 * belum disertakan di respons progress()). Pronunciation (Fase 2) TETAP
 * tidak ada -- belum dibangun sama sekali. */
export function AdminStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [classes, setClasses] = useState<ClassListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [targetClassId, setTargetClassId] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    const [studentRes, progressRes] = await Promise.all([
      apiClient.GET("/admin/students/{id}", { params: { path: { id } } }),
      apiClient.GET("/admin/students/{id}/progress", { params: { path: { id } } }),
    ]);
    if (studentRes.error || !studentRes.data || progressRes.error || !progressRes.data) {
      setError("Gagal memuat data murid.");
      return;
    }
    setError(null);
    setStudent(studentRes.data);
    setProgress(progressRes.data);
    setTargetClassId(studentRes.data.class.id);
  }

  useEffect(() => {
    load();
    apiClient.GET("/admin/classes", { params: { query: {} } }).then(({ data }) => {
      if (data) setClasses(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleMoveClass() {
    if (!id || !student || targetClassId === student.class.id) return;
    setActionBusy(true);
    setActionError(null);
    const { error: apiError } = await apiClient.PATCH("/admin/students/{id}", { params: { path: { id } }, body: { classId: targetClassId } });
    setActionBusy(false);
    if (apiError) {
      setActionError("Gagal memindahkan kelas.");
      return;
    }
    await load();
  }

  async function toggleActive() {
    if (!id || !student) return;
    const nextStatus = student.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setActionBusy(true);
    setActionError(null);
    const { error: apiError } = await apiClient.PATCH("/admin/students/{id}", { params: { path: { id } }, body: { status: nextStatus } });
    setActionBusy(false);
    if (apiError) {
      setActionError(`Gagal ${nextStatus === "INACTIVE" ? "menonaktifkan" : "mengaktifkan"} murid.`);
      return;
    }
    await load();
  }

  async function handleResetPassword() {
    if (!id) return;
    setActionBusy(true);
    setActionError(null);
    setResetMessage(null);
    const { data, error: apiError, response } = await apiClient.POST("/admin/students/{id}/reset-password", { params: { path: { id } } });
    const status = response.status; // dibaca SEBELUM penyempitan tipe di bawah (openapi-fetch: cabang error tanpa tipe = `never`)
    setActionBusy(false);
    if (apiError || !data) {
      // 429 = batas per-email (server menjawab jujur untuk admin, tidak seperti endpoint publik yang
      // sengaja diam) -- teksnya sudah Indonesia dan menyebut batasnya, jadi diteruskan apa adanya.
      const serverMessage = (apiError as { message?: unknown } | undefined)?.message;
      setActionError(status === 429 && typeof serverMessage === "string" ? serverMessage : "Gagal mengirim email reset password.");
      return;
    }
    setResetMessage(data.message);
  }

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!student || !progress) return <div className="p-6 text-sm text-gray-500">Memuat...</div>;

  const activeClasses = (classes ?? []).filter((c) => c.status === "ACTIVE" || c.id === student.class.id);

  return (
    <div className="space-y-6">
      <Link to="/students" className="text-sm text-blue-600 hover:underline">
        &larr; Kembali ke daftar murid
      </Link>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{student.name}</h2>
            <p className="text-sm text-gray-600">{student.email}</p>
            <p className="mt-1 text-sm text-gray-500">
              Kelas: {student.class.name} &middot; Bergabung {new Date(student.createdAt).toLocaleDateString("id-ID")}
              {student.lastActiveAt && <> &middot; Terakhir aktif {new Date(student.lastActiveAt).toLocaleDateString("id-ID")}</>}
            </p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs ${student.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
            {student.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
          <div className="space-y-1">
            <label htmlFor="move-class" className="block text-sm font-medium text-gray-700">
              Pindah Kelas
            </label>
            <div className="flex gap-2">
              <select
                id="move-class"
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {activeClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button variant="secondary" disabled={actionBusy || targetClassId === student.class.id} onClick={handleMoveClass}>
                Pindahkan
              </Button>
            </div>
          </div>
          <Button variant="secondary" disabled={actionBusy} onClick={toggleActive}>
            {student.status === "ACTIVE" ? "Nonaktifkan Murid" : "Aktifkan Murid"}
          </Button>
          <Button variant="secondary" disabled={actionBusy} onClick={handleResetPassword}>
            Kirim Email Reset Password
          </Button>
        </div>
        {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
        {resetMessage && <p className="mt-2 text-sm text-green-700">{resetMessage}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Level" value={progress.level.level} />
        <StatCard label="Total XP" value={progress.xpTotal} />
        <StatCard label="Streak Saat Ini" value={progress.streak.current} />
        <StatCard label="Streak Terpanjang" value={progress.streak.longest} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-medium text-gray-900">Progres per Unit</h3>
        {progress.unitProgress.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Belum ada lesson yang diselesaikan.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="pb-2 font-normal">Unit</th>
                <th className="pb-2 font-normal">Lesson Selesai</th>
                <th className="pb-2 font-normal">Rata-rata Bintang</th>
              </tr>
            </thead>
            <tbody>
              {progress.unitProgress.map((u) => (
                <tr key={u.unitId} className="border-b border-gray-50">
                  <td className="py-2 text-gray-900">{u.unitTitle}</td>
                  <td className="py-2 text-gray-600">{u.completedLessons}</td>
                  <td className="py-2 text-gray-600">{u.averageStars.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-medium text-gray-900">Skor Percakapan</h3>
        {progress.scenarioProgress.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Belum ada skenario percakapan yang dicoba.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="pb-2 font-normal">Skenario</th>
                <th className="pb-2 font-normal">Percobaan</th>
                <th className="pb-2 font-normal">Skor Terbaik</th>
                <th className="pb-2 font-normal">Terakhir Dicoba</th>
              </tr>
            </thead>
            <tbody>
              {progress.scenarioProgress.map((s) => (
                <tr key={s.scenarioId} className="border-b border-gray-50">
                  <td className="py-2 text-gray-900">{s.titleJp}</td>
                  <td className="py-2 text-gray-600">{s.attempts}</td>
                  <td className="py-2 text-gray-600">{s.bestScore}</td>
                  <td className="py-2 text-gray-600">{new Date(s.lastAttemptAt).toLocaleDateString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-medium text-gray-900">Aktivitas Terbaru</h3>
        {progress.recentActivity.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Belum ada aktivitas XP dalam 90 hari terakhir.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="pb-2 font-normal">Sumber</th>
                <th className="pb-2 font-normal">XP</th>
                <th className="pb-2 font-normal">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {progress.recentActivity.map((e, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-900">{SOURCE_LABEL[e.source]}</td>
                  <td className="py-2 text-gray-600">+{e.amount}</td>
                  <td className="py-2 text-gray-600">{new Date(e.at).toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
