import { useEffect, useRef, useState } from "react";
import { Button } from "@elearning/ui";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";

type DueFlashcard = components["schemas"]["DueFlashcardDto"];

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "reviewing"; cards: DueFlashcard[]; index: number; revealed: boolean; correctCount: number; wrongCount: number; submitting: boolean }
  | { status: "done"; correctCount: number; wrongCount: number; total: number };

/** Flashcard (SUP-02) -- deck otomatis dari `GET /flashcards/due`
 * (`ReviewItem` yang jatuh tempo, lihat flashcards.service.ts). BEDA PENTING
 * dari Lesson/Percakapan: TIDAK ada "sesi" server-authoritative yang
 * di-replay dari log event -- tiap `POST /flashcards/review` adalah
 * operasi MANDIRI, murid SENDIRI yang melaporkan benar/salah (self-graded,
 * bukan dicocokkan ke kunci jawaban -- flashcard itu recall bebas, tidak
 * ada "opsi" untuk dicocokkan server). Makanya halaman ini TIDAK butuh pola
 * `useRef`+`version` seperti LessonPage/ConversationPage (tidak ada objek
 * sesi domain yang mutable) -- array+index+revealed cukup sebagai state
 * React biasa.
 *
 * SENGAJA TIDAK ada requeue kartu yang dijawab salah dalam sesi yang sama
 * (gaya Anki "tampilkan lagi sebentar lagi") -- backend (`SrsService.
 * recordVocabAnswer`) tidak punya konsep pengulangan jarak-pendek sama
 * sekali, jawaban salah langsung dijadwalkan ulang +1 hari. Menambahkan
 * requeue di sini cuma akan memanggil endpoint yang sama berkali-kali
 * untuk kartu yang sama dalam satu sesi tanpa efek SRS yang berbeda --
 * gap yang dicatat di docs/PLAN.md, bukan cuma terlewat. */
export function FlashcardsPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    apiClient.GET("/flashcards/due").then(({ data, error }) => {
      if (error || !data) {
        setState({ status: "error", message: "Gagal memuat kartu." });
        return;
      }
      if (data.length === 0) {
        setState({ status: "empty" });
        return;
      }
      setState({ status: "reviewing", cards: data, index: 0, revealed: false, correctCount: 0, wrongCount: 0, submitting: false });
    });
  }, []);

  function reveal() {
    if (state.status !== "reviewing") return;
    setState({ ...state, revealed: true });
  }

  async function answer(correct: boolean) {
    if (state.status !== "reviewing" || state.submitting) return;
    const card = state.cards[state.index]!;
    setState({ ...state, submitting: true });
    const { error } = await apiClient.POST("/flashcards/review", { body: { itemId: card.itemId, correct } });
    if (error) {
      setState({ ...state, submitting: false });
      return;
    }
    const correctCount = state.correctCount + (correct ? 1 : 0);
    const wrongCount = state.wrongCount + (correct ? 0 : 1);
    const nextIndex = state.index + 1;
    if (nextIndex >= state.cards.length) {
      setState({ status: "done", correctCount, wrongCount, total: state.cards.length });
    } else {
      setState({ status: "reviewing", cards: state.cards, index: nextIndex, revealed: false, correctCount, wrongCount, submitting: false });
    }
  }

  if (state.status === "loading") return <div className="p-6 text-sm text-gray-500">Memuat...</div>;
  if (state.status === "error") return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{state.message}</div>;
  if (state.status === "empty") {
    return (
      <div data-testid="flashcards-empty" className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center">
        <p className="text-3xl">🎉</p>
        <p className="mt-2 text-gray-700">Tidak ada kartu untuk direview hari ini. Kerjakan lebih banyak lesson supaya ada kata baru masuk antrian!</p>
      </div>
    );
  }
  if (state.status === "done") {
    return (
      <div data-testid="flashcards-done" className="mx-auto max-w-md space-y-2 rounded-lg border border-gray-200 bg-white p-6 text-center">
        <p className="text-3xl">✅</p>
        <h1 className="text-xl font-semibold text-gray-900">Review Selesai</h1>
        <p className="text-sm text-gray-600">
          {state.correctCount} benar, {state.wrongCount} salah dari {state.total} kartu.
        </p>
      </div>
    );
  }

  const card = state.cards[state.index]!;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.round((state.index / state.cards.length) * 100)}%` }} />
      </div>
      <p className="text-center text-xs text-gray-500">
        Kartu {state.index + 1} dari {state.cards.length}
      </p>

      <div data-testid="flashcard" className="space-y-3 rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-3xl">{card.surface}</p>
        <p className="text-gray-500">
          {card.reading} &middot; {card.romaji}
        </p>
        {card.audio && (
          <audio controls src={card.audio} className="mx-auto h-8" />
        )}

        {state.revealed ? (
          <>
            <div data-testid="flashcard-back" className="border-t border-gray-100 pt-3">
              <p className="text-lg text-gray-800">{card.meaning ?? "(tidak ada arti tersimpan)"}</p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button data-testid="answer-wrong" variant="secondary" disabled={state.submitting} onClick={() => answer(false)}>
                Salah
              </Button>
              <Button data-testid="answer-correct" disabled={state.submitting} onClick={() => answer(true)}>
                Benar
              </Button>
            </div>
          </>
        ) : (
          <Button data-testid="reveal-button" onClick={reveal} className="mt-2">
            Tampilkan Jawaban
          </Button>
        )}
      </div>
    </div>
  );
}
