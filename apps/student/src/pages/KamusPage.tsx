import { useEffect, useRef, useState } from "react";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";

type DictionaryEntry = components["schemas"]["DictionaryEntryDto"];

const DEBOUNCE_MS = 300;

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
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label htmlFor="dictionary-search" className="block text-sm font-medium text-gray-700">
          Cari kata (kana, romaji, kanji, atau arti Indonesia)
        </label>
        <input
          id="dictionary-search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="mis. あ, a, atau 'halo'"
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {query.trim().length === 0 ? (
        <p className="text-sm text-gray-500">Ketik untuk mulai mencari.</p>
      ) : loading ? (
        <div className="p-6 text-sm text-gray-500">Mencari...</div>
      ) : results && results.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada hasil untuk &quot;{query}&quot;.</p>
      ) : (
        <div className="space-y-3">
          {(results ?? []).map((entry) => (
            <div key={entry.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{entry.surface}</p>
                  <p className="text-sm text-gray-500">
                    {entry.reading} &middot; {entry.romaji}
                  </p>
                </div>
                {entry.audio && (
                  <button
                    type="button"
                    onClick={() => playAudio(entry.audio)}
                    className="rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                    aria-label="Putar audio"
                  >
                    🔊
                  </button>
                )}
              </div>
              {entry.meaning && <p className="mt-2 text-sm text-gray-800">{entry.meaning}</p>}
              {entry.partOfSpeech && (
                <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{entry.partOfSpeech}</span>
              )}
              {entry.exampleJp && (
                <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
                  <p className="text-gray-800">{entry.exampleJp}</p>
                  {entry.exampleId && <p className="text-gray-500">{entry.exampleId}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
