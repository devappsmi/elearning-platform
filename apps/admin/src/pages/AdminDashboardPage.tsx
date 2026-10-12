import { useEffect, useState } from "react";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";

type DashboardSummary = components["schemas"]["DashboardSummaryDto"];

const STREAK_BUCKET_ORDER = ["0", "1-3", "4-7", "8-14", "15-30", "30+"];

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

/** Dashboard (ADM-30) -- GET /admin/dashboard, kartu ringkasan yang sudah
 * ada+teruji sejak Milestone 9, baru sekarang punya UI. Semua angka dihitung
 * langsung dari tabel (tidak ada cache), lihat admin-dashboard.service.ts. */
export function AdminDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.GET("/admin/dashboard").then(({ data, error: apiError }) => {
      if (cancelled) return;
      if (apiError || !data) {
        setError("Gagal memuat dashboard.");
        return;
      }
      setSummary(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!summary) return <div className="p-6 text-sm text-gray-500">Memuat...</div>;

  const maxStreakCount = Math.max(1, ...STREAK_BUCKET_ORDER.map((b) => summary.streakDistribution[b] ?? 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Murid aktif minggu ini" value={summary.activeStudentsThisWeek} />
        <StatCard label="Total murid aktif" value={summary.totalActiveStudents} />
        <StatCard label="Rata-rata XP" value={summary.averageXp} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium text-gray-900">Distribusi Streak</h2>
        <div className="mt-3 flex items-end gap-3">
          {STREAK_BUCKET_ORDER.map((bucket) => {
            const count = summary.streakDistribution[bucket] ?? 0;
            return (
              <div key={bucket} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end">
                  <div
                    className="w-full rounded-t bg-blue-500"
                    style={{ height: `${(count / maxStreakCount) * 100}%`, minHeight: count > 0 ? "4px" : "0" }}
                  />
                </div>
                <span className="text-xs text-gray-500">{bucket}</span>
                <span className="text-xs font-medium text-gray-900">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium text-gray-900">Tingkat Penyelesaian Lesson per Kelas</h2>
        {summary.lessonCompletionRateByClass.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Belum ada kelas aktif.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="pb-2 font-normal">Kelas</th>
                <th className="pb-2 font-normal">Murid</th>
                <th className="pb-2 font-normal">Penyelesaian</th>
              </tr>
            </thead>
            <tbody>
              {summary.lessonCompletionRateByClass.map((row) => (
                <tr key={row.classId} className="border-b border-gray-50">
                  <td className="py-2 text-gray-900">{row.className}</td>
                  <td className="py-2 text-gray-600">{row.studentCount}</td>
                  <td className="py-2 text-gray-600">{Math.round(row.completionRate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
