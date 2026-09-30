import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ScenarioSession, TEST_MODE_MAX_MISTAKES } from "@elearning/domain";
import type { ScenarioAnswerFeedback, ScenarioContent, ScenarioLine, ScenarioMode } from "@elearning/domain";
import { apiClient } from "../auth/api-client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { Loading, Notice } from "../components/ui/Feedback";
import { FeedbackPanel } from "../components/ui/FeedbackPanel";
import { Icon } from "../components/ui/icons";
import { ProgressBar } from "../components/ui/ProgressBar";

type ScenarioDetail = { id: string; titleJp: string; titleId: string; level: string; content: ScenarioContent };
type AnswerEvent = { lineIndex: number; optionIndex: number };

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "intro" }
  | { status: "active" }
  | { status: "submitting" };

/** Percakapan (CONV-01..05) -- satu halaman menangani DUA sub-tahap: intro
 * (info skenario + pilih mode Latihan/Tes, belum ada ScenarioSession) dan
 * sesi aktif (ScenarioSession berjalan). BEDA dari LessonPage yang langsung
 * aktif tanpa pemilihan mode -- skenario PUNYA konsep mode (CONV-03/04,
 * practice vs test), lesson tidak.
 *
 * `GET /scenarios/:id` SENGAJA tidak dianotasi tipe balik di
 * scenarios.controller.ts (lihat catatan di sana) -- responnya di-cast
 * manual ke sini, pola identik dengan LessonPage/`Unit`+`Lesson`.
 *
 * Log event (`{lineIndex, optionIndex}[]`, HANYA dari baris `choice` --
 * baris `narration` tidak perlu dijawab) dikirim APA ADANYA ke
 * `POST /scenarios/:id/attempts` -- server menghitung ulang skor dari nol
 * lewat `ScenarioSession`-nya sendiri, sama seperti lesson. */
export function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scenarioRef = useRef<ScenarioDetail | null>(null);
  const sessionRef = useRef<ScenarioSession | null>(null);
  // `ScenarioSession.current`/`currentIndex` adalah GETTER yang MELEMPAR
  // begitu `isFinished` true (lihat scenarioSession.ts) -- termasuk kalau
  // sesi baru saja gagal (mode tes, kesempatan salah habis) DI TENGAH
  // menampilkan feedback baris choice terakhir. Render tidak bisa
  // langsung membaca `session.current` lagi setelah itu (akan crash).
  // Jadi baris "sekarang" ditangkap ke ref ini SEBELUM sesi mungkin
  // selesai, dipakai ulang (bukan dibaca ulang dari session) selama
  // frame terakhir sesi yang gagal itu ditampilkan.
  const currentLineRef = useRef<{ line: ScenarioLine; index: number } | null>(null);
  const eventsRef = useRef<AnswerEvent[]>([]);
  const modeRef = useRef<ScenarioMode>("practice");
  const startedAtRef = useRef(0);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    scenarioRef.current = null;
    sessionRef.current = null;

    apiClient.GET("/scenarios/{id}", { params: { path: { id: id! } } }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setState({ status: "error", message: "Gagal memuat skenario." });
        return;
      }
      // Cast disengaja -- lihat catatan kelas di atas.
      scenarioRef.current = data as unknown as ScenarioDetail;
      setState({ status: "intro" });
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  function startSession(mode: ScenarioMode) {
    const scenario = scenarioRef.current!;
    sessionRef.current = new ScenarioSession({ scenario: scenario.content, mode });
    eventsRef.current = [];
    modeRef.current = mode;
    startedAtRef.current = Date.now();
    setState({ status: "active" });
  }

  async function finishAndSubmit() {
    setState({ status: "submitting" });
    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
    const { data, error } = await apiClient.POST("/scenarios/{id}/attempts", {
      params: { path: { id: id! } },
      body: { mode: modeRef.current === "test" ? "TEST" : "PRACTICE", events: eventsRef.current, durationSec },
    });
    if (error || !data) {
      setState({ status: "error", message: "Gagal mengirim hasil percakapan." });
      return;
    }
    navigate(`/conversation/${id}/result`, { state: { result: data }, replace: true });
  }

  function handleChoice(optionIndex: number) {
    const session = sessionRef.current!;
    if (session.current.kind !== "choice") return;
    eventsRef.current.push({ lineIndex: session.currentIndex, optionIndex });
    session.submitChoice(optionIndex);
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
        <Button onClick={() => navigate("/conversation")}>Kembali ke Percakapan</Button>
      </div>
    );
  }
  if (state.status === "submitting") return <Loading label="Mengirim hasil..." />;

  const scenario = scenarioRef.current!;

  if (state.status === "intro") {
    return <ScenarioIntro scenario={scenario} onStart={startSession} />;
  }

  const session = sessionRef.current!;
  void version; // pemicu re-render -- lihat catatan identik di LessonPage.tsx

  // Cuma baca session.current/currentIndex kalau AMAN (belum selesai) --
  // lihat catatan currentLineRef di atas. Sesudah gagal, baris terakhir
  // yang berhasil ditangkap tetap dipakai untuk frame ini.
  if (!session.isFinished) {
    currentLineRef.current = { line: session.current, index: session.currentIndex };
  }
  const { line, index } = currentLineRef.current!;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="sr-only">{scenario.titleId}</h1>
      <div className="flex items-center gap-3">
        <Link
          to="/conversation"
          aria-label="Tutup percakapan"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-rose-600 hover:shadow focus-visible:outline-secondary-600"
        >
          <Icon name="x" className="h-6 w-6" strokeWidth={2.8} />
        </Link>
        <ProgressBar className="flex-1" size="lg" tone="pink" value={Math.round(session.progress * 100)} label="Kemajuan percakapan" />
      </div>

      {line.kind === "narration" ? (
        <NarrationLineView key={index} line={line} isLastLine={index === session.scenario.lines.length - 1} onNext={handleNext} />
      ) : (
        <ChoiceLineView
          key={index}
          line={line}
          feedback={session.pendingFeedback}
          isFinished={session.isFinished}
          isLastLine={index === session.scenario.lines.length - 1}
          onAnswer={handleChoice}
          onNext={handleNext}
        />
      )}
    </div>
  );
}

function ScenarioIntro({ scenario, onStart }: { scenario: ScenarioDetail; onStart: (mode: ScenarioMode) => void }) {
  const { content } = scenario;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600 p-6 text-center text-white shadow-glow md:p-8">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-3 -top-8 select-none text-[9rem] font-black leading-none text-white/10"
        >
          話
        </span>
        <p aria-hidden="true" className="relative text-5xl motion-safe:animate-float">
          🗣️
        </p>
        <h1 className="relative mt-3 text-3xl font-black text-white md:text-4xl">{scenario.titleJp}</h1>
        <p className="relative mt-1 text-lg font-bold text-white">{scenario.titleId}</p>
        <p className="relative mt-3 flex flex-wrap items-center justify-center gap-2 text-sm font-extrabold">
          <Chip tone="white">{content.roles.join(", ")}</Chip>
          <Chip tone="white">~{content.estimatedMinutes} menit</Chip>
          <Chip tone="white">{scenario.level}</Chip>
        </p>
      </section>

      {content.grammarNotes.length > 0 && (
        <Card tone="sky">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <span aria-hidden="true">📝</span>
            Catatan Tata Bahasa
          </h2>
          {content.grammarNotes.map((note) => (
            <div key={note.id} className="mt-3 rounded-2xl bg-white/80 p-3 ring-1 ring-sky-100">
              <p className="text-sm font-extrabold text-slate-900">{note.title}</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-600">{note.bodyMd}</p>
            </div>
          ))}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card tone="emerald" padding="sm" className="flex flex-col gap-3">
          <p className="text-sm font-bold text-slate-700">Santai: boleh mengulang tanpa batas sampai jawabanmu benar.</p>
          <Button data-testid="start-practice" variant="secondary" size="lg" block onClick={() => onStart("practice")}>
            Latihan
          </Button>
        </Card>
        <Card tone="pink" padding="sm" className="flex flex-col gap-3">
          <p className="text-sm font-bold text-slate-700">
            Ada batas: hanya {TEST_MODE_MAX_MISTAKES} kali salah, lalu sesi berhenti.
          </p>
          <Button data-testid="start-test" size="lg" block onClick={() => onStart("test")}>
            Mulai Tes
          </Button>
        </Card>
      </div>
    </div>
  );
}

/** Kepala tiap baris dialog: lencana pembicara. */
function Speaker({ name, tone = "sky" }: { name: string; tone?: "sky" | "secondary" }) {
  return (
    <p className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black text-white ${
          tone === "sky" ? "bg-gradient-to-br from-sky-500 to-primary-600" : "bg-gradient-to-br from-secondary-500 to-tertiary-600"
        }`}
      >
        {(Array.from(name)[0] ?? "?").toUpperCase()}
      </span>
      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">{name}</span>
    </p>
  );
}

function NarrationLineView({
  line,
  isLastLine,
  onNext,
}: {
  line: Extract<ScenarioLine, { kind: "narration" }>;
  isLastLine: boolean;
  onNext: () => void;
}) {
  return (
    <Card data-testid="narration-line" tone="sky" padding="lg" className="space-y-3">
      <Speaker name={line.speaker} />
      <p className="text-3xl font-black leading-snug text-slate-900">{line.jp}</p>
      <p className="text-base font-extrabold text-secondary-700">{line.romaji}</p>
      <p className="text-base font-semibold text-slate-700">{line.meaning}</p>
      <Button data-testid="next-button" size="lg" onClick={onNext} className="mt-2">
        {isLastLine ? "Selesai" : "Lanjut"}
      </Button>
    </Card>
  );
}

function ChoiceLineView({
  line,
  feedback,
  isFinished,
  isLastLine,
  onAnswer,
  onNext,
}: {
  line: Extract<ScenarioLine, { kind: "choice" }>;
  feedback: ScenarioAnswerFeedback | null;
  isFinished: boolean;
  isLastLine: boolean;
  onAnswer: (index: number) => void;
  onNext: () => void;
}) {
  // Sesi akan selesai begitu tombol ini diklik kalau: baru saja gagal (mode
  // tes, kesempatan salah habis -- `isFinished` SUDAH true di sini, lihat
  // catatan next() di scenarioSession.ts), ATAU ini baris choice TERAKHIR
  // dan dijawab benar (next() akan meng-advance index ke luar batas).
  const willFinish = feedback !== null && (isFinished || (feedback.correct && isLastLine));
  // Pilihan murid, hanya untuk pewarnaan sesudah menjawab (komponen di-remount per baris: key=index).
  const [chosen, setChosen] = useState<number | null>(null);

  return (
    <Card data-testid="choice-line" tone="secondary" padding="lg" className="space-y-4">
      <Speaker name={line.speaker} tone="secondary" />
      <div className="space-y-3">
        {line.options.map((opt, i) => {
          const answered = feedback !== null;
          const picked = answered && chosen === i;
          const tone = picked
            ? feedback.correct
              ? "border-emerald-500 bg-emerald-50 text-emerald-900"
              : "border-rose-500 bg-rose-50 text-rose-900 motion-safe:animate-shake"
            : answered
              ? "border-slate-200 bg-white text-slate-500 opacity-60"
              : "border-slate-200 bg-white text-slate-800 hover:border-secondary-300 hover:bg-secondary-50 active:translate-y-0.5 active:border-b-2";
          return (
            <button
              key={i}
              type="button"
              data-testid="choice-option"
              data-text={opt.jp}
              disabled={answered}
              onClick={() => {
                setChosen(i);
                onAnswer(i);
              }}
              className={`block w-full rounded-2xl border-2 border-b-4 px-4 py-3.5 text-left text-lg font-extrabold transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300 disabled:cursor-not-allowed ${tone}`}
            >
              {opt.jp}
            </button>
          );
        })}
      </div>
      {feedback && (
        <FeedbackPanel
          data-testid="feedback"
          data-correct={feedback.correct}
          correct={feedback.correct}
          detail={feedback.feedbackId || undefined}
          nextLabel={willFinish ? "Lihat Hasil" : feedback.correct ? "Lanjut" : "Coba Lagi"}
          onNext={onNext}
        />
      )}
    </Card>
  );
}
