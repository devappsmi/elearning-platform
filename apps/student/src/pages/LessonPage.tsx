import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LessonSession } from "@elearning/domain";
import type { Lesson, Unit } from "@elearning/domain";
import { apiClient } from "../auth/api-client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Loading, Notice } from "../components/ui/Feedback";
import { FeedbackPanel } from "../components/ui/FeedbackPanel";
import { Icon } from "../components/ui/icons";
import { ProgressBar } from "../components/ui/ProgressBar";

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

  if (state.status === "loading") return <Loading />;
  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Notice tone="error" role="alert">
          {state.message}
        </Notice>
        <Button onClick={() => navigate("/")}>Kembali ke Beranda</Button>
      </div>
    );
  }
  if (state.status === "submitting") return <Loading label="Mengirim hasil..." />;

  const session = sessionRef.current!;
  void version; // `version` sendiri tidak dibaca di JSX -- session (mutable, lewat ref) yang dibaca;
  // `version` cuma pemicu re-render (setVersion di bump()), makanya harus tetap "dipakai" di sini
  // supaya lint tidak menganggapnya variable mati.

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Judul pelajaran untuk pembaca layar (layar belajar sengaja tanpa judul tampak: fokus ke soal). */}
      <h1 className="sr-only">{session.lesson.title}</h1>
      <div className="flex items-center gap-3">
        <Link
          to="/"
          aria-label="Tutup pelajaran"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-rose-600 hover:shadow focus-visible:outline-violet-600"
        >
          <Icon name="x" className="h-6 w-6" strokeWidth={2.8} />
        </Link>
        <ProgressBar className="flex-1" size="lg" value={Math.round(session.progress * 100)} label="Kemajuan pelajaran" />
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
    <FeedbackPanel
      data-testid="feedback"
      data-correct={feedback.correct}
      data-correct-answer={feedback.correctAnswer}
      correct={feedback.correct}
      detail={feedback.correct ? undefined : `Jawaban yang benar: ${feedback.correctAnswer}`}
      nextLabel="Lanjut"
      onNext={onNext}
    />
  );
}

/** Soal: satu-dua karakter (mis. sebuah huruf kana) tampil sebagai lambang besar di ubin berwarna; selebihnya teks tebal. */
function Prompt({ text, sub, small }: { text: string; sub?: string | null; small?: boolean }) {
  const glyph = !small && Array.from(text).length <= 2;
  return (
    <div className="space-y-2 text-center">
      <p
        className={
          glyph
            ? "mx-auto grid h-32 w-32 place-items-center rounded-[2rem] bg-gradient-to-br from-violet-100 via-fuchsia-100 to-pink-100 text-7xl font-black text-violet-800 shadow-inner ring-1 ring-violet-200"
            : `font-black leading-snug text-slate-900 ${small ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"}`
        }
      >
        {text}
      </p>
      {sub && <p className="text-base font-bold text-slate-600">{sub}</p>}
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
  // Pilihan murid hanya untuk pewarnaan sesudah menjawab; komponen ini di-remount per soal (key=refId).
  const [chosen, setChosen] = useState<number | null>(null);
  if (current.kind !== "choose") return null;
  const feedback = session.pendingFeedback;

  return (
    <Card data-testid="choose-exercise" padding="lg" className="space-y-6">
      <Prompt text={current.prompt} sub={current.promptSub} />
      <div className="grid grid-cols-2 gap-3">
        {current.options.map((opt, i) => {
          const answered = feedback !== null;
          const isCorrectOption = answered && i === current.correctIndex;
          const isWrongChoice = answered && !feedback.correct && chosen === i;
          const tone = isCorrectOption
            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
            : isWrongChoice
              ? "border-rose-500 bg-rose-50 text-rose-900 motion-safe:animate-shake"
              : answered
                ? "border-slate-200 bg-white text-slate-500 opacity-60"
                : "border-slate-200 bg-white text-slate-800 hover:border-violet-300 hover:bg-violet-50 active:translate-y-0.5 active:border-b-2";
          return (
            <button
              key={i}
              type="button"
              data-testid="choose-option"
              data-text={opt.text}
              disabled={answered}
              onClick={() => {
                setChosen(i);
                onAnswer(i);
              }}
              className={`rounded-2xl border-2 border-b-4 px-3 py-4 text-lg font-extrabold transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 disabled:cursor-not-allowed ${tone}`}
            >
              {opt.text}
              {opt.sub && <span className="block text-xs font-bold opacity-80">{opt.sub}</span>}
            </button>
          );
        })}
      </div>
      {feedback && <FeedbackBanner feedback={feedback} onNext={onNext} />}
    </Card>
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
    <Card data-testid="assemble-exercise" padding="lg" className="space-y-5">
      <Prompt text={current.prompt} sub={current.promptSub} small />

      <div className="flex min-h-16 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/60 p-3">
        {picked.length === 0 && <span className="px-1 text-sm font-bold text-slate-500">Ketuk kata di bawah untuk menyusun jawabanmu</span>}
        {picked.map((i, pos) => (
          <button
            key={pos}
            type="button"
            data-testid="picked-token"
            disabled={feedback !== null}
            onClick={() => setPicked((p) => p.filter((_, idx) => idx !== pos))}
            className="rounded-xl border-2 border-b-4 border-violet-300 bg-violet-100 px-4 py-2 text-lg font-extrabold text-violet-900 transition hover:bg-violet-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bank[i]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {available.map(({ token, i }) => (
          <button
            key={i}
            type="button"
            data-testid="bank-token"
            data-text={token}
            disabled={feedback !== null}
            onClick={() => setPicked((p) => [...p, i])}
            className="rounded-xl border-2 border-b-4 border-slate-200 bg-white px-4 py-2 text-lg font-extrabold text-slate-800 transition hover:border-violet-300 hover:bg-violet-50 active:translate-y-0.5 active:border-b-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {token}
          </button>
        ))}
      </div>

      {feedback ? (
        <FeedbackBanner feedback={feedback} onNext={onNext} />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button
            data-testid="check-button"
            size="lg"
            className="flex-1"
            disabled={picked.length === 0}
            onClick={() => onAnswer(picked.map((i) => bank[i]!))}
          >
            Periksa Jawaban
          </Button>
          <Button variant="secondary" size="lg" disabled={picked.length === 0} onClick={() => setPicked([])}>
            Ulangi
          </Button>
        </div>
      )}
    </Card>
  );
}
