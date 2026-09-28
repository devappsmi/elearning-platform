import { useEffect, useState } from "react";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";
import { useAuth } from "../auth/AuthContext";

type LeaderboardResponse = components["schemas"]["LeaderboardResponseDto"];

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Leaderboard (GAM-03) -- GET /leaderboard, peringkat XP mingguan SATU
 * KELAS (bukan lintas kelas/institusi), reset otomatis tiap Senin lewat
 * Redis sorted set berkunci tanggal minggu (lihat week.util.ts) -- tidak
 * ada job terjadwal, "reset"-nya cuma efek dari kunci yang berbeda tiap
 * minggu. Baris murid yang sedang login disorot supaya langsung kelihatan
 * posisinya sendiri tanpa harus mencari di daftar. */
export function LeaderboardPage() {
  const { me } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.GET("/leaderboard").then(({ data, error: apiError }) => {
      if (apiError || !data) {
        setError("Gagal memuat leaderboard.");
        return;
      }
      setLeaderboard(data);
    });
  }, []);

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!leaderboard) return <div className="p-6 text-sm text-gray-500">Memuat...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Peringkat Minggu Ini</h2>
        <p className="text-sm text-gray-500">Minggu dimulai {new Date(leaderboard.weekOf).toLocaleDateString("id-ID")}</p>
      </div>

      {leaderboard.entries.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada aktivitas XP minggu ini di kelasmu. Mulai belajar untuk masuk peringkat!</p>
      ) : (
        <table className="w-full rounded-lg border border-gray-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="p-3 font-normal">Peringkat</th>
              <th className="p-3 font-normal">Nama</th>
              <th className="p-3 font-normal">XP</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.entries.map((entry) => (
              <tr key={entry.userId} className={`border-b border-gray-50 ${entry.userId === me.id ? "bg-blue-50" : ""}`}>
                <td className="p-3 text-gray-900">
                  {RANK_MEDAL[entry.rank] ?? `#${entry.rank}`}
                </td>
                <td className="p-3 text-gray-900">
                  {entry.name}
                  {entry.userId === me.id && <span className="ml-2 text-xs text-blue-600">(kamu)</span>}
                </td>
                <td className="p-3 text-gray-600">{entry.xp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
