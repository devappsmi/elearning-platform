import { useEffect, useRef, useState } from "react";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";
import { Card } from "../components/ui/Card";
import type { CardTone } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { Notice } from "../components/ui/Feedback";
import { Icon } from "../components/ui/icons";
import { PageHeader } from "../components/ui/PageHeader";

type DictionaryEntry = components["schemas"]["DictionaryEntryDto"];

const DEBOUNCE_MS = 300;

// Semburat warna kartu hasil bergantian supaya daftar terasa hidup.
const CARD_TONES: CardTone[] = ["secondary", "pink", "sky", "amber", "emerald", "primary"];

/** Kamus (SUP-01) -- GET /dictionary?q=, cari via kana/romaji/kanji/arti
 * Indonesia (backend sudah menangani ketiganya lewat OR di beberapa kolom,
 * lihat dictionary.service.ts). Pencarian live-as-you-type dengan debounce
 * sederhana -- bukan tombol submit, supaya terasa seperti kamus sungguhan.
 * Data kamus sendiri BELUM lengkap (baru ~107 entri dari target PRD 1500,
 * lihat docs/PLAN.md) -- gap authoring konten, bukan UI. Audio SENGAJA
 * cuma dirender kalau `entry.audio` tidak kosong -- lingkungan ini tidak
 * punya kredensial TTS (lihat bagian 6b), jadi kebanyakan entri belum
 * punya audio sungguhan; tombol putar disembunyikan daripada menampilkan
 * player yang pasti gagal. */
export function KamusPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DictionaryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults(null);
      setError(null);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      apiClient.GET("/dictionary", { params: { query: { q: trimmed } } }).then(({ data, error: apiError }) => {
        setLoading(false);
        if (apiError || !data) {
          setError("Gagal mencari kamus.");
          return;
        }
        setError(null);
        setResults(data);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  function playAudio(url: string) {
    if (!audioRef.current) return;
    audioRef.current.src = url;
    audioRef.current.play();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Kamus" subtitle="Cari kata dalam kana, romaji, kanji, atau bahasa Indonesia." emoji="📖" tone="emerald" />

      <Card tone="emerald" padding="sm" className="mb-6">
        <label htmlFor="dictionary-search" className="block text-sm font-extrabold text-slate-800">
          Cari kata (kana, romaji, kanji, atau arti Indonesia)
        </label>
        <div className="relative mt-2">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            id="dictionary-search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="mis. あ, a, atau 'halo'"
            className="w-full rounded-2xl border-2 border-slate-300 bg-white py-3 pl-12 pr-4 text-lg font-semibold text-slate-900 transition placeholder:text-slate-400 hover:border-emerald-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
          />
        </div>
      </Card>

      {error && (
        <Notice tone="error" role="alert" className="mb-6">
          {error}
        </Notice>
      )}

      {query.trim().length === 0 ? (
        <div className="grid place-items-center gap-2 py-10 text-center">
          <span aria-hidden="true" className="text-5xl motion-safe:animate-float">
            🔍
          </span>
          <p className="text-base font-bold text-slate-600">Ketik untuk mulai mencari.</p>
        </div>
      ) : loading ? (
        <div className="grid place-items-center gap-2 py-10 text-center">
          <span aria-hidden="true" className="text-5xl motion-safe:animate-bounce">
            🌸
          </span>
          <p className="text-base font-bold text-slate-600">Mencari...</p>
        </div>
      ) : results && results.length === 0 ? (
        <div className="grid place-items-center gap-2 py-10 text-center">
          <span aria-hidden="true" className="text-5xl">
            🤔
          </span>
          <p className="text-base font-bold text-slate-600">Tidak ada hasil untuk &quot;{query}&quot;.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(results ?? []).map((entry, index) => (
            <Card key={entry.id} tone={CARD_TONES[index % CARD_TONES.length]} className="motion-safe:animate-slide-up">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-3xl font-black leading-tight text-slate-900">{entry.surface}</p>
                  <p className="mt-0.5 text-sm font-extrabold text-secondary-700">
                    {entry.reading} &middot; {entry.romaji}
                  </p>
                </div>
                {entry.audio && (
                  <button
                    type="button"
                    onClick={() => playAudio(entry.audio)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-secondary-600 to-tertiary-600 text-white shadow-[0_3px_0_0_theme(colors.secondary.900)] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300"
                    aria-label="Putar audio"
                  >
                    <Icon name="speaker" className="h-5 w-5" />
                  </button>
                )}
              </div>
              {entry.meaning && <p className="mt-3 text-lg font-extrabold text-slate-800">{entry.meaning}</p>}
              {entry.partOfSpeech && (
                <Chip tone="secondary" className="mt-2 px-2.5 py-0.5 text-xs">
                  {entry.partOfSpeech}
                </Chip>
              )}
              {entry.exampleJp && (
                <div className="mt-3 rounded-2xl bg-white/80 p-3 text-sm ring-1 ring-slate-100">
                  <p className="font-bold text-slate-800">{entry.exampleJp}</p>
                  {entry.exampleId && <p className="font-semibold text-slate-600">{entry.exampleId}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
