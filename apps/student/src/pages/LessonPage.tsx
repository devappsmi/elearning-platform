import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LessonSession } from "@elearning/domain";
import type { Lesson, Unit } from "@elearning/domain";
import { Button } from "@elearning/ui";
import { apiClient } from "../auth/api-client";

type AnswerEvent = { ref: string; kind: "choose" | "assemble"; choiceText?: string; tokens?: string[] };

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "active" }
  | { status: "submitting" };

/** Belajar (S1-S5 PRD) -- inti produk. `GET /lessons/:id` mengirim
 * {unit, lesson} bentuk `@elearning/domain` APA ADANYA (termasuk kunci
 * jawaban) supaya `LessonSession` bisa dijalankan DI BROWSER untuk feedback
 * instan per-soal ("server-authoritative, client-optimistic", lihat plan
 * "Keputusan Lintas-Sektor"). Endpoint ini SENGAJA tidak dianotasi tipe
 * balik di controller (lihat catatan di lessons.controller.ts) supaya
 * packages/domain tidak perlu tahu soal Swagger -- di sini responnya
 * di-cast manual ke tipe {unit: Unit, lesson: Lesson} milik
 * @elearning/domain, yang memang bentuk asli datanya (content.mapper.ts
 * sisi server membangunnya dari situ).
 *
 * Log event jawaban (urutan kronologis, TERMASUK percobaan ulang atas soal
 * yang sempat salah -- LessonSession.next() meng-antre ulang ke akhir,
 * bukan retry-in-place seperti ScenarioSession) dikirim APA ADANYA ke
 * POST /lessons/:id/attempts -- server yang menghitung ulang skor dari nol
 * lewat LessonSession-nya sendiri, client tidak pernah mengirim skor. */
export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const sessionRef = useRef<LessonSession | null>(null);
  const eventsRef = useRef<AnswerEvent[]>([]);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    sessionRef.current = null;
    eventsRef.current = [];

    apiClient.GET("/lessons/{id}", { params: { path: { id: lessonId! } } }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setState({ status: "error", message: "Gagal memuat pelajaran." });
        return;
      }
      // Cast disengaja -- lihat catatan kelas di atas.
      const { unit, lesson } = data as unknown as { unit: Unit; lesson: Lesson };
      sessionRef.current = new LessonSession({ unit, lesson });
      setState({ status: "active" });
    });

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function finishAndSubmit() {
    setState({ status: "submitting" });
    const { data, error } = await apiClient.POST("/lessons/{id}/attempts", {
      params: { path: { id: lessonId! } },
      body: { answers: eventsRef.current },
    });
    if (error || !data) {
      setState({ status: "error", message: "Gagal mengirim hasil belajar." });
      return;
    }
    navigate(`/learn/${lessonId}/result`, { state: { result: data }, replace: true });
  }

  function handleChoice(index: number) {
    const session = sessionRef.current!;
    const current = session.current;
    if (current.kind !== "choose") return;
    eventsRef.current.push({ ref: current.refId, kind: "choose", choiceText: current.options[index]!.text });
    session.submitChoice(index);
    bump();
  }

  function handleAssemble(tokens: string[]) {
    const session = sessionRef.current!;
    const current = session.current;
    if (current.kind !== "assemble") return;
    eventsRef.current.push({ ref: current.refId, kind: "assemble", tokens });
    session.submitAssemble(tokens);
    bump();
  }

  function handleNext() {
    const session = sessionRef.current!;
    session.next();
    if (session.isFinished) {
      void finishAndSubmit();
    } else {
      bump();
    }
  }

  if (state.status === "loading") return <div className="p-6 text-sm text-gray-500">Memuat...</div>;
  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {state.message}{" "}
        <button className="underline" onClick={() => navigate("/")}>
          Kembali ke Beranda
        </button>
      </div>
    );
  }
  if (state.status === "submitting") return <div className="p-6 text-sm text-gray-500">Mengirim hasil...</div>;

  const session = sessionRef.current!;
  void version; // `version` sendiri tidak dibaca di JSX -- session (mutable, lewat ref) yang dibaca;
  // `version` cuma pemicu re-render (setVersion di bump()), makanya harus tetap "dipakai" di sini
  // supaya lint tidak menganggapnya variable mati.

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.round(session.progress * 100)}%` }} />
      </div>

      {session.current.kind === "choose" ? (
        <ChooseExercise key={session.current.refId} session={session} onAnswer={handleChoice} onNext={handleNext} />
      ) : (
        <AssembleExercise key={session.current.refId} session={session} onAnswer={handleAssemble} onNext={handleNext} />
      )}
    </div>
  );
}

function FeedbackBanner({ feedback, onNext }: { feedback: { correct: boolean; correctAnswer: string }; onNext: () => void }) {
  return (
    <div
      data-testid="feedback"
      data-correct={feedback.correct}
      data-correct-answer={feedback.correctAnswer}
      className={`rounded-lg border p-4 ${feedback.correct ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}
    >
      <p className="font-medium">{feedback.correct ? "Benar!" : "Kurang tepat"}</p>
      {!feedback.correct && <p className="mt-1 text-sm">Jawaban yang benar: {feedback.correctAnswer}</p>}
      <Button data-testid="next-button" onClick={onNext} className="mt-3">
        Lanjut
      </Button>
    </div>
  );
}

function ChooseExercise({
  session,
  onAnswer,
  onNext,
}: {
  session: LessonSession;
  onAnswer: (index: number) => void;
  onNext: () => void;
}) {
  const current = session.current;
  if (current.kind !== "choose") return null;
  const feedback = session.pendingFeedback;

  return (
    <div data-testid="choose-exercise" className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
      <p className="text-2xl">{current.prompt}</p>
      {current.promptSub && <p className="text-sm text-gray-500">{current.promptSub}</p>}
      <div className="grid grid-cols-2 gap-2">
        {current.options.map((opt, i) => (
          <button
            key={i}
            data-testid="choose-option"
            data-text={opt.text}
            disabled={feedback !== null}
            onClick={() => onAnswer(i)}
            className="rounded-md border border-gray-300 px-3 py-3 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {opt.text}
            {opt.sub && <span className="block text-xs text-gray-500">{opt.sub}</span>}
          </button>
        ))}
      </div>
      {feedback && <FeedbackBanner feedback={feedback} onNext={onNext} />}
    </div>
  );
}

function AssembleExercise({
  session,
  onAnswer,
  onNext,
}: {
  session: LessonSession;
  onAnswer: (tokens: string[]) => void;
  onNext: () => void;
}) {
  const current = session.current;
  const feedback = session.pendingFeedback;
  // Parent (LessonPage) me-render komponen ini dengan `key={refId}` -- ganti
  // soal berarti remount PENUH, `picked` otomatis reset ke [] tanpa perlu
  // effect/ref pelacak refId manual di sini.
  const [picked, setPicked] = useState<number[]>([]);

  const bank = useMemo(() => (current.kind === "assemble" ? current.bank : []), [current]);
  if (current.kind !== "assemble") return null;

  const available = bank.map((token, i) => ({ token, i })).filter(({ i }) => !picked.includes(i));

  return (
    <div data-testid="assemble-exercise" className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
      <p className="text-lg">{current.prompt}</p>
      {current.promptSub && <p className="text-sm text-gray-500">{current.promptSub}</p>}

      <div className="min-h-12 flex flex-wrap gap-2 rounded-md border border-dashed border-gray-300 p-3">
        {picked.map((i, pos) => (
          <button
            key={pos}
            data-testid="picked-token"
            disabled={feedback !== null}
            onClick={() => setPicked((p) => p.filter((_, idx) => idx !== pos))}
            className="rounded-md bg-blue-100 px-3 py-1.5 text-sm text-blue-800 disabled:opacity-50"
          >
            {bank[i]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {available.map(({ token, i }) => (
          <button
            key={i}
            data-testid="bank-token"
            data-text={token}
            disabled={feedback !== null}
            onClick={() => setPicked((p) => [...p, i])}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {token}
          </button>
        ))}
      </div>

      {feedback ? (
        <FeedbackBanner feedback={feedback} onNext={onNext} />
      ) : (
        <div className="flex gap-2">
          <Button data-testid="check-button" disabled={picked.length === 0} onClick={() => onAnswer(picked.map((i) => bank[i]!))}>
            Periksa Jawaban
          </Button>
          <Button variant="secondary" disabled={picked.length === 0} onClick={() => setPicked([])}>
            Ulangi
          </Button>
        </div>
      )}
    </div>
  );
}
