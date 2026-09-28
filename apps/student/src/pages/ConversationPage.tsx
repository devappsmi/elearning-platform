import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ScenarioSession } from "@elearning/domain";
import type { ScenarioAnswerFeedback, ScenarioContent, ScenarioLine, ScenarioMode } from "@elearning/domain";
import { Button } from "@elearning/ui";
import { apiClient } from "../auth/api-client";

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

  if (state.status === "loading") return <div className="p-6 text-sm text-gray-500">Memuat...</div>;
  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {state.message}{" "}
        <button className="underline" onClick={() => navigate("/conversation")}>
          Kembali ke Percakapan
        </button>
      </div>
    );
  }
  if (state.status === "submitting") return <div className="p-6 text-sm text-gray-500">Mengirim hasil...</div>;

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
    <div className="mx-auto max-w-lg space-y-4">
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.round(session.progress * 100)}%` }} />
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
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <p className="text-2xl font-semibold text-gray-900">{scenario.titleJp}</p>
        <p className="text-gray-600">{scenario.titleId}</p>
        <p className="mt-2 text-sm text-gray-500">
          {content.roles.join(", ")} &middot; ~{content.estimatedMinutes} menit &middot; {scenario.level}
        </p>
      </div>

      {content.grammarNotes.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="font-medium text-gray-900">Catatan Tata Bahasa</h3>
          {content.grammarNotes.map((note) => (
            <div key={note.id} className="mt-2">
              <p className="text-sm font-medium text-gray-800">{note.title}</p>
              <p className="text-sm text-gray-600">{note.bodyMd}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-2">
        <Button data-testid="start-practice" variant="secondary" onClick={() => onStart("practice")}>
          Latihan
        </Button>
        <Button data-testid="start-test" onClick={() => onStart("test")}>
          Mulai Tes
        </Button>
      </div>
    </div>
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
    <div data-testid="narration-line" className="space-y-2 rounded-lg border border-gray-200 bg-white p-6">
      <p className="text-xs font-medium uppercase text-gray-400">{line.speaker}</p>
      <p className="text-xl">{line.jp}</p>
      <p className="text-sm text-gray-500">{line.romaji}</p>
      <p className="text-sm text-gray-700">{line.meaning}</p>
      <Button data-testid="next-button" onClick={onNext} className="mt-2">
        {isLastLine ? "Selesai" : "Lanjut"}
      </Button>
    </div>
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

  return (
    <div data-testid="choice-line" className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
      <p className="text-xs font-medium uppercase text-gray-400">{line.speaker}</p>
      <div className="space-y-2">
        {line.options.map((opt, i) => (
          <button
            key={i}
            data-testid="choice-option"
            data-text={opt.jp}
            disabled={feedback !== null}
            onClick={() => onAnswer(i)}
            className="block w-full rounded-md border border-gray-300 px-3 py-3 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {opt.jp}
          </button>
        ))}
      </div>
      {feedback && (
        <div
          data-testid="feedback"
          data-correct={feedback.correct}
          className={`rounded-lg border p-4 ${feedback.correct ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}
        >
          <p className="font-medium">{feedback.correct ? "Benar!" : "Kurang tepat"}</p>
          {feedback.feedbackId && <p className="mt-1 text-sm">{feedback.feedbackId}</p>}
          <Button data-testid="next-button" onClick={onNext} className="mt-3">
            {willFinish ? "Lihat Hasil" : feedback.correct ? "Lanjut" : "Coba Lagi"}
          </Button>
        </div>
      )}
    </div>
  );
}
