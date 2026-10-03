import { useEffect, useState } from "react";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../components/ui/Avatar";
import { Card } from "../components/ui/Card";
import { Loading, Notice } from "../components/ui/Feedback";
import { PageHeader } from "../components/ui/PageHeader";

type LeaderboardResponse = components["schemas"]["LeaderboardResponseDto"];

type Entry = LeaderboardResponse["entries"][number];

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

// Podium juara 1-3: urutan tampil 2-1-3 (juara 1 di tengah dan paling tinggi). Teks gelap di atas emas/perak/perunggu (≥ 4,5:1).
const PODIUM: Record<number, { order: string; height: string; block: string; avatar: "lg" | "xl" }> = {
  1: { order: "order-2", height: "h-32", block: "from-amber-300 to-amber-500 text-amber-950", avatar: "xl" },
  2: { order: "order-1", height: "h-24", block: "from-slate-200 to-slate-400 text-slate-900", avatar: "lg" },
  3: { order: "order-3", height: "h-20", block: "from-orange-300 to-orange-500 text-orange-950", avatar: "lg" },
};

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

  if (error) return <Notice tone="error" role="alert">{error}</Notice>;
  if (!leaderboard) return <Loading />;

  const podium = leaderboard.entries.filter((entry) => entry.rank in PODIUM).sort((a, b) => a.rank - b.rank);
  const rest = leaderboard.entries.filter((entry) => !(entry.rank in PODIUM));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Peringkat Minggu Ini"
        subtitle={`Minggu dimulai ${new Date(leaderboard.weekOf).toLocaleDateString("id-ID")}`}
        emoji="🏆"
        tone="amber"
      />

      {leaderboard.entries.length === 0 ? (
        <Card tone="amber" padding="lg" className="text-center">
          <p aria-hidden="true" className="text-5xl motion-safe:animate-float">
            🏁
          </p>
          <p className="mt-3 text-base font-bold text-slate-700">
            Belum ada aktivitas XP minggu ini di kelasmu. Mulai belajar untuk masuk peringkat!
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {podium.length > 0 && (
            <Card tone="amber" padding="lg" className="overflow-hidden pb-0 md:pb-0">
              <ol className="flex items-end justify-center gap-3 md:gap-6">
                {podium.map((entry) => (
                  <PodiumPlace key={entry.userId} entry={entry} isMe={entry.userId === me.id} />
                ))}
              </ol>
            </Card>
          )}

          {rest.length > 0 && (
            <Card padding="none" className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary-50 text-left text-xs font-extrabold uppercase tracking-wider text-secondary-800">
                    <th scope="col" className="p-3 pl-5">
                      Peringkat
                    </th>
                    <th scope="col" className="p-3">
                      Nama
                    </th>
                    <th scope="col" className="p-3 pr-5 text-right">
                      XP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((entry) => {
                    const mine = entry.userId === me.id;
                    return (
                      <tr key={entry.userId} className={`border-t border-slate-100 ${mine ? "bg-secondary-50" : ""}`}>
                        <td className="p-3 pl-5">
                          <span className="inline-grid h-9 min-w-9 place-items-center rounded-full bg-slate-100 px-2 font-black text-slate-700">
                            {RANK_MEDAL[entry.rank] ?? `#${entry.rank}`}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="flex items-center gap-3 font-extrabold text-slate-900">
                            <Avatar name={entry.name} size="sm" />
                            <span className="min-w-0 truncate">
                              {entry.name}
                              {mine && <span className="ml-2 text-xs font-extrabold text-secondary-700">(kamu)</span>}
                            </span>
                          </span>
                        </td>
                        <td className="p-3 pr-5 text-right">
                          <span className="rounded-full bg-secondary-100 px-3 py-1 font-black text-secondary-800">{entry.xp}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function PodiumPlace({ entry, isMe }: { entry: Entry; isMe: boolean }) {
  const place = PODIUM[entry.rank]!;
  return (
    <li className={`flex w-full max-w-[10.5rem] flex-1 flex-col items-center text-center ${place.order}`}>
      <span className="sr-only">Peringkat {entry.rank}: </span>
      <span aria-hidden="true" className={entry.rank === 1 ? "text-4xl motion-safe:animate-float" : "text-3xl"}>
        {entry.rank === 1 ? "👑" : RANK_MEDAL[entry.rank]}
      </span>
      <Avatar name={entry.name} size={place.avatar} className={isMe ? "ring-4 !ring-secondary-500" : ""} />
      <p className="mt-2 w-full truncate text-sm font-extrabold text-slate-900 md:text-base">{entry.name}</p>
      {isMe && <p className="text-xs font-extrabold text-secondary-700">(kamu)</p>}
      <p className="mb-2 mt-1 rounded-full bg-white px-3 py-0.5 text-sm font-black text-secondary-800 shadow-sm ring-1 ring-secondary-100">
        {entry.xp} XP
      </p>
      <div
        aria-hidden="true"
        className={`grid w-full place-items-center rounded-t-2xl bg-gradient-to-b text-4xl font-black ${place.height} ${place.block}`}
      >
        {entry.rank}
      </div>
    </li>
  );
}
