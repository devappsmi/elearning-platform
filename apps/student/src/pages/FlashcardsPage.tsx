import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";
import { Button, buttonClasses } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Loading, Notice } from "../components/ui/Feedback";
import { PageHeader } from "../components/ui/PageHeader";
import { ProgressBar } from "../components/ui/ProgressBar";

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

  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <Notice tone="error" role="alert">{state.message}</Notice>;
  if (state.status === "empty") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Flashcard" subtitle="Ulangi kata-kata yang sudah kamu pelajari." emoji="🎴" tone="sky" />
        <Card data-testid="flashcards-empty" tone="emerald" padding="lg" className="text-center">
          <p aria-hidden="true" className="text-6xl motion-safe:animate-float">
            🎉
          </p>
          <p className="mt-3 text-lg font-bold text-slate-700">
            Tidak ada kartu untuk direview hari ini. Kerjakan lebih banyak lesson supaya ada kata baru masuk antrian!
          </p>
          <Link to="/" className={buttonClasses({ size: "lg", className: "mt-5" })}>
            Ke Beranda
          </Link>
        </Card>
      </div>
    );
  }
  if (state.status === "done") {
    return (
      <div className="mx-auto max-w-xl">
        <Card data-testid="flashcards-done" tone="emerald" padding="lg" className="space-y-3 text-center motion-safe:animate-pop-in">
          <p aria-hidden="true" className="text-6xl">
            ✅
          </p>
          <h1 className="text-3xl font-black text-slate-900">Review Selesai</h1>
          <p className="text-base font-bold text-slate-600">
            {state.correctCount} benar, {state.wrongCount} salah dari {state.total} kartu.
          </p>
          <Link to="/" className={buttonClasses({ size: "lg", className: "mt-2" })}>
            Kembali ke Beranda
          </Link>
        </Card>
      </div>
    );
  }

  const card = state.cards[state.index]!;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Flashcard" subtitle="Ulangi kata-kata yang sudah kamu pelajari." emoji="🎴" tone="sky" />
      <div className="space-y-3">
        <ProgressBar value={state.index} max={state.cards.length} label="Kemajuan kartu" tone="sky" size="lg" />
        <p className="text-center text-sm font-extrabold text-slate-600">
          Kartu {state.index + 1} dari {state.cards.length}
        </p>

        <div
          key={state.index}
          data-testid="flashcard"
          className="overflow-hidden rounded-[2rem] border border-white bg-white shadow-card motion-safe:animate-pop-in"
        >
          <div className="bg-gradient-to-br from-primary-600 via-secondary-600 to-tertiary-600 px-6 py-10 text-center text-white">
            <p className="text-6xl font-black leading-tight md:text-7xl">{card.surface}</p>
            <p className="mt-3 text-lg font-bold text-white">
              {card.reading} &middot; {card.romaji}
            </p>
            {card.audio && <audio controls src={card.audio} className="mx-auto mt-4 h-9 max-w-full" />}
          </div>

          <div className="space-y-4 p-5 text-center">
            {state.revealed ? (
              <>
                <div
                  data-testid="flashcard-back"
                  className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-4 motion-safe:animate-pop-in"
                >
                  <p className="text-xl font-black text-emerald-900">{card.meaning ?? "(tidak ada arti tersimpan)"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button data-testid="answer-wrong" variant="danger" size="lg" disabled={state.submitting} onClick={() => answer(false)}>
                    Salah
                  </Button>
                  <Button data-testid="answer-correct" variant="success" size="lg" disabled={state.submitting} onClick={() => answer(true)}>
                    Benar
                  </Button>
                </div>
              </>
            ) : (
              <Button data-testid="reveal-button" size="lg" block onClick={reveal}>
                Tampilkan Jawaban
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
