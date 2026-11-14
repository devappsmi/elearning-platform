import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";
import { Card } from "../components/ui/Card";
import type { CardTone } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import type { ChipTone } from "../components/ui/Chip";
import { Loading, Notice } from "../components/ui/Feedback";
import { Icon } from "../components/ui/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { TUTOR_PATH } from "../lib/tutor-chat";

type ScenarioSummary = components["schemas"]["ScenarioSummaryDto"];

// Warna kartu skenario bergantian: semburat kartu, ubin ikon, dan warna pil level.
const STYLES: { card: CardTone; tile: string; chip: ChipTone }[] = [
  { card: "pink", tile: "from-pink-500 to-rose-600", chip: "pink" },
  { card: "sky", tile: "from-sky-500 to-primary-600", chip: "sky" },
  { card: "amber", tile: "from-amber-400 to-orange-500", chip: "amber" },
  { card: "emerald", tile: "from-emerald-500 to-teal-600", chip: "emerald" },
];

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

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Percakapan" subtitle="Berlatih bercakap-cakap dalam situasi sehari-hari." emoji="💬" tone="pink" />

      <Link
        to={TUTOR_PATH}
        data-testid="open-ai-chat"
        className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300"
      >
        <Card tone="secondary" className="flex items-center gap-4 transition duration-150 group-hover:-translate-y-0.5 group-hover:shadow-glow">
          <span
            aria-hidden="true"
            className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary-600 via-secondary-600 to-tertiary-600 text-3xl shadow-lg"
          >
            🎙️
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black leading-tight text-slate-900">Ngobrol dengan AI</p>
            <p className="text-sm font-bold text-slate-700">Bicara bebas lewat suara. AI membalas dan membetulkan kalimatmu.</p>
          </div>
          <Chip tone="secondary" className="shrink-0">
            Baru
          </Chip>
          <Icon
            name="arrowRight"
            className="hidden h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-secondary-600 sm:block"
            strokeWidth={2.6}
          />
        </Card>
      </Link>

      <h2 className="mb-3 mt-8 text-lg font-black text-slate-900">Skenario latihan</h2>
      {error ? (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      ) : !scenarios ? (
        <Loading />
      ) : scenarios.length === 0 ? (
        <Card tone="pink" padding="lg" className="text-center">
          <p aria-hidden="true" className="text-5xl motion-safe:animate-float">
            🗣️
          </p>
          <p className="mt-3 text-base font-bold text-slate-700">Belum ada skenario percakapan tersedia.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {scenarios.map((s, i) => {
            const style = STYLES[i % STYLES.length]!;
            return (
              <Link
                key={s.id}
                to={`/conversation/${s.id}`}
                className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-300"
              >
                <Card
                  tone={style.card}
                  className="flex items-center gap-4 transition duration-150 group-hover:-translate-y-0.5 group-hover:shadow-glow"
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-3xl shadow-lg ${style.tile}`}
                  >
                    🗣️
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-black leading-tight text-slate-900">{s.titleJp}</p>
                    <p className="text-sm font-bold text-slate-700">{s.titleId}</p>
                    <p className="mt-1 text-xs font-bold text-slate-600">
                      {s.roles.join(", ")} &middot; ~{s.estimatedMinutes} menit
                    </p>
                  </div>
                  <Chip tone={style.chip} className="shrink-0">
                    {s.level}
                  </Chip>
                  <Icon
                    name="arrowRight"
                    className="hidden h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-pink-600 sm:block"
                    strokeWidth={2.6}
                  />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
