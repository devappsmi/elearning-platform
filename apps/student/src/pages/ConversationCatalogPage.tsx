import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";

type ScenarioSummary = components["schemas"]["ScenarioSummaryDto"];

/** Percakapan (CONV-01) -- katalog skenario dari GET /scenarios (cuma yang
 * berstatus PUBLISHED, lihat scenarios.service.ts). Baru 1 skenario yang
 * diauthoring sejauh ini (`perkenalan`, lihat docs/PLAN.md bagian 6d) --
 * halaman ini sudah menangani N skenario dengan benar, cuma datanya yang
 * belum banyak (gap authoring konten, bukan UI). */
export function ConversationCatalogPage() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.GET("/scenarios").then(({ data, error: apiError }) => {
      if (apiError || !data) {
        setError("Gagal memuat daftar skenario.");
        return;
      }
      setScenarios(data);
    });
  }, []);

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!scenarios) return <div className="p-6 text-sm text-gray-500">Memuat...</div>;
  if (scenarios.length === 0) return <p className="text-sm text-gray-500">Belum ada skenario percakapan tersedia.</p>;

  return (
    <div className="space-y-3">
      {scenarios.map((s) => (
        <Link
          key={s.id}
          to={`/conversation/${s.id}`}
          className="block rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-gray-900">{s.titleJp}</p>
              <p className="text-sm text-gray-600">{s.titleId}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{s.level}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {s.roles.join(", ")} &middot; ~{s.estimatedMinutes} menit
          </p>
        </Link>
      ))}
    </div>
  );
}
