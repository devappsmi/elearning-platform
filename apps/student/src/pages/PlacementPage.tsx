import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";
import { NETWORK_ERROR_TEXT, failureText, readFailure, type ApiFailure } from "../auth/api-errors";
import { ExercisePrompt } from "../components/ExercisePrompt";
import { Button, buttonClasses } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Confetti } from "../components/ui/Confetti";
import { Loading, Notice } from "../components/ui/Feedback";
import { Icon } from "../components/ui/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { ProgressBar } from "../components/ui/ProgressBar";
import { langOf } from "../lib/lang";
import { PLACEMENT_INSTRUCTION, joinTitles, minimumCorrect } from "../lib/placement";

type Status = components["schemas"]["PlacementStatusView"];
type Outcome = components["schemas"]["PlacementOutcomeView"];
type Test = components["schemas"]["PlacementTestView"];
type AttemptResult = components["schemas"]["PlacementAttemptResultView"];
/** Jawaban per soal: teks opsi, `null` = "Belum tahu", `undefined` = belum dijawab. */
type Answer = string | null | undefined;

type View =
  | { kind: "loading" }
  | { kind: "load-error" }
  | { kind: "status"; status: Status }
  | { kind: "test"; test: Test }
  | { kind: "result"; result: AttemptResult };

/** Pesan bisnis dari server (sudah berbahasa Indonesia) untuk penolakan yang memang ditujukan ke murid:
 * dimatikan (403), sudah pernah ikut (409), tes kedaluwarsa (410). Selain itu teks bawaan. */
function placementFailureText(failure: ApiFailure, fallback: string): string {
  if ([403, 409, 410].includes(failure.status) && typeof failure.message === "string") return failure.message;
  return failureText(failure, fallback);
}

/** Tes penempatan (PRD AUTH-05, opsional): menentukan unit tempat murid mulai. Soal dan penilaiannya di server
 * (apps/api/src/placement); halaman ini hanya menampilkan soal TANPA kunci jawaban dan mengirim pilihan murid, jadi
 * tidak ada umpan balik benar/salah per soal -- hasilnya baru terlihat setelah semua dikirim. Bisa dilewati: murid
 * yang tidak ikut tes mulai dari awal jalur. */
export function PlacementPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);

  useEffect(() => {
    let cancelled = false;
    setView({ kind: "loading" });
    apiClient
      .GET("/placement")
      .then(({ data }) => {
        if (!cancelled) setView(data ? { kind: "status", status: data } : { kind: "load-error" });
      })
      .catch(() => {
        if (!cancelled) setView({ kind: "load-error" });
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function startTest() {
    setError(null);
    setBusy(true);
    try {
      const { data, error: apiError, response } = await apiClient.POST("/placement/tests");
      if (data) {
        setIndex(0);
        setAnswers(data.questions.map(() => undefined));
        setView({ kind: "test", test: data });
      } else {
        setError(placementFailureText(readFailure(response, apiError), "Tes belum bisa dimulai. Coba lagi sebentar lagi."));
        if (response?.status === 409 || response?.status === 403) setReload((n) => n + 1);
      }
    } catch {
      setError(NETWORK_ERROR_TEXT);
    } finally {
      setBusy(false);
    }
  }

  async function submit(test: Test, final: Answer[]) {
    setError(null);
    setBusy(true);
    try {
      const { data, error: apiError, response } = await apiClient.POST("/placement/attempts", {
        body: { testId: test.testId, answers: final.map((choiceText) => ({ choiceText: choiceText ?? null })) },
      });
      if (data) {
        setView({ kind: "result", result: data });
      } else if (response?.status === 409) {
        setReload((n) => n + 1); // sudah pernah ikut (mis. dari tab lain): tampilkan hasil yang tersimpan
      } else if (response?.status === 410) {
        // Kedaluwarsa atau diganti tes baru: jawaban ini tidak bisa dinilai lagi.
        setError(placementFailureText(readFailure(response, apiError), "Waktu tes habis. Mulai tes lagi."));
        setView({ kind: "loading" });
        setReload((n) => n + 1);
      } else {
        setError(placementFailureText(readFailure(response, apiError), "Jawaban belum terkirim. Coba kirim lagi."));
      }
    } catch {
      setError(NETWORK_ERROR_TEXT);
    } finally {
      setBusy(false);
    }
  }

  if (view.kind === "loading") return <Loading />;
  if (view.kind === "load-error") {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Notice tone="error" role="alert">
          Gagal memuat tes penempatan.
        </Notice>
        <Button onClick={() => setReload((n) => n + 1)}>Coba lagi</Button>
      </div>
    );
  }
  if (view.kind === "result") return <ResultView result={view.result} onDone={() => navigate("/", { replace: true })} />;
  if (view.kind === "test") {
    const { test } = view;
    const question = test.questions[index]!;
    const last = index === test.questions.length - 1;
    const choose = (answer: Answer) => setAnswers((prev) => prev.map((a, i) => (i === index ? answer : a)));
    return (
      <QuestionView
        test={test}
        index={index}
        answer={answers[index]}
        busy={busy}
        error={error}
        onChoose={choose}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => {
          if (last) void submit(test, answers);
          else setIndex(index + 1);
        }}
        key={question.id}
      />
    );
  }

  const { status } = view;
  if (status.result) return <TakenView outcome={status.result} />;
  if (!status.available) return <UnavailableView enabled={status.enabled} />;
  return <IntroView status={status} busy={busy} error={error} onStart={startTest} onSkip={() => navigate("/", { replace: true })} />;
}

function IntroView({ status, busy, error, onStart, onSkip }: { status: Status; busy: boolean; error: string | null; onStart: () => void; onSkip: () => void }) {
  const sections = joinTitles(status.sections.map((s) => s.title));
  const rules = [
    `${status.questionCount} soal pilihan ganda: membaca huruf dan mengenali arti kata.`,
    `Benar minimal ${status.passPercent}% di bagian ${sections}: bagian itu dilewati dan kamu langsung mulai dari unit berikutnya.`,
    "Tidak yakin? Pilih \"Belum tahu\" daripada menebak, supaya hasilnya tepat.",
    "Tes hanya bisa diambil sekali. Unit yang dilewati tetap bisa kamu pelajari kapan saja.",
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="placement-intro">
      <PageHeader title="Tes penempatan" emoji="🧭" tone="sky" subtitle={`Sudah bisa membaca ${sections}? Buktikan, lalu lompati bagian itu.`} />
      <Card padding="lg" className="space-y-4">
        <ul className="space-y-3 text-base font-semibold text-slate-700">
          {rules.map((rule) => (
            <li key={rule} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700">
                <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3.4} />
              </span>
              {rule}
            </li>
          ))}
        </ul>
        {error && (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="secondary" size="lg" onClick={onSkip} data-testid="placement-skip">
            Lewati, mulai dari awal
          </Button>
          <Button size="lg" onClick={onStart} disabled={busy} data-testid="placement-start">
            {busy ? "Menyiapkan soal..." : "Mulai tes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface QuestionViewProps {
  test: Test;
  index: number;
  answer: Answer;
  busy: boolean;
  error: string | null;
  onChoose: (answer: Answer) => void;
  onPrev: () => void;
  onNext: () => void;
}

function QuestionView({ test, index, answer, busy, error, onChoose, onPrev, onNext }: QuestionViewProps) {
  const question = test.questions[index]!;
  const total = test.questions.length;
  const last = index === total - 1;
  const instruction = PLACEMENT_INSTRUCTION[question.kind];
  const section = test.sections.length > 1 ? test.sections.find((s) => s.unitId === question.sectionUnitId)?.title : undefined;
  const tile = (checked: boolean) =>
    `flex h-full items-center justify-center rounded-2xl border-2 border-b-4 px-3 py-4 text-center text-lg font-extrabold transition duration-150 peer-focus-visible:ring-4 peer-focus-visible:ring-secondary-300 ${
      checked ? "border-secondary-500 bg-secondary-50 text-secondary-900" : "border-slate-200 bg-white text-slate-800 hover:border-secondary-300 hover:bg-secondary-50"
    }`;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="sr-only">Tes penempatan</h1>
      <div className="flex items-center gap-3">
        <Link
          to="/"
          aria-label="Keluar dari tes"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-rose-600 hover:shadow focus-visible:outline-secondary-600"
        >
          <Icon name="x" className="h-6 w-6" strokeWidth={2.8} />
        </Link>
        <ProgressBar className="flex-1" size="lg" value={index} max={total} label="Kemajuan tes" />
      </div>

      <Card data-testid="placement-question" data-kind={question.kind} padding="lg" className="space-y-6">
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-extrabold text-slate-600">
          <span data-testid="placement-counter">
            Soal {index + 1} dari {total}
          </span>
          {section && <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-900">{section}</span>}
        </p>
        <ExercisePrompt text={question.prompt} sub={question.promptSub} />
        <fieldset className="space-y-3">
          <legend className="mb-3 w-full text-center text-base font-extrabold text-slate-800">
            {instruction}
            <span className="sr-only"> {question.prompt}</span>
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {question.options.map((option) => (
              <label key={option.text} className="block cursor-pointer">
                <input
                  type="radio"
                  name={`answer-${question.id}`}
                  value={option.text}
                  checked={answer === option.text}
                  onChange={() => onChoose(option.text)}
                  className="peer sr-only"
                  data-testid="placement-option"
                />
                <span lang={langOf(option.text)} className={tile(answer === option.text)}>
                  <span>
                    {option.text}
                    {option.sub && <span className="block text-xs font-bold opacity-80">{option.sub}</span>}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <label className="block cursor-pointer">
            <input
              type="radio"
              name={`answer-${question.id}`}
              value=""
              checked={answer === null}
              onChange={() => onChoose(null)}
              className="peer sr-only"
              data-testid="placement-unknown"
            />
            <span className={`${tile(answer === null)} border-dashed text-base`}>Belum tahu</span>
          </label>
        </fieldset>
        {error && (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        )}
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" size="lg" onClick={onPrev} disabled={index === 0 || busy} data-testid="placement-prev">
            Sebelumnya
          </Button>
          <Button size="lg" onClick={onNext} disabled={answer === undefined || busy} data-testid="placement-next">
            {last ? (busy ? "Mengirim..." : "Kirim jawaban") : "Lanjut"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StartUnitLine({ outcome }: { outcome: Outcome }) {
  if (!outcome.startUnit) return null;
  return (
    <p className="text-base font-semibold text-slate-700" data-testid="placement-start-unit">
      Kamu mulai dari <span className="font-black text-slate-900">{outcome.startUnit.title}</span>
      <span className="whitespace-nowrap"> (level {outcome.startUnit.levelName})</span>.
    </p>
  );
}

function ResultView({ result, onDone }: { result: AttemptResult; onDone: () => void }) {
  const passed = result.skippedUnits.length > 0;
  const firstFailed = result.sections.find((s) => !s.passed);
  return (
    <div className="mx-auto max-w-lg space-y-5 text-center" data-testid="placement-result" data-passed={passed}>
      {passed && <Confetti />}
      <div
        className={`relative overflow-hidden rounded-[2rem] p-7 text-white shadow-glow motion-safe:animate-pop-in ${
          passed ? "bg-gradient-to-br from-primary-600 via-secondary-600 to-tertiary-600" : "bg-gradient-to-br from-sky-600 via-primary-600 to-secondary-600"
        }`}
      >
        <p aria-hidden="true" className="text-6xl motion-safe:animate-float">
          {passed ? "🎉" : "🌱"}
        </p>
        <h1 className="mt-3 text-balance text-3xl font-black text-white">
          {passed ? `Hebat! ${joinTitles(result.skippedUnits.map((u) => u.title))} dilewati` : "Kita mulai dari awal"}
        </h1>
        <p className="mt-2 text-base font-bold text-white" data-testid="placement-score">
          {result.correct} dari {result.total} jawaban benar
        </p>
      </div>

      <Card padding="md" className="space-y-4 text-left">
        <StartUnitLine outcome={result} />
        <ul className="space-y-2">
          {result.sections.map((s) => (
            <li key={s.unitId} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              <span>
                {s.title}: {s.correct}/{s.total} benar
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${s.passed ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                {s.passed ? "Lulus" : `Perlu ${minimumCorrect(s.total, result.passPercent)}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm font-semibold text-slate-600">
          {passed
            ? "Unit yang dilewati tetap terbuka kalau kamu ingin mengulang."
            : `Tidak apa-apa! Pelajaran ${firstFailed?.title ?? ""} akan membantumu membaca dengan lancar.`}
        </p>
      </Card>

      <Button variant="sun" size="lg" onClick={onDone}>
        Mulai belajar
        <Icon name="arrowRight" className="h-5 w-5" strokeWidth={2.6} />
      </Button>
    </div>
  );
}

function TakenView({ outcome }: { outcome: Outcome }) {
  const date = new Date(outcome.takenAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="placement-taken">
      <PageHeader title="Tes penempatan" emoji="🧭" tone="sky" subtitle={`Sudah kamu ikuti pada ${date}.`} />
      <Card padding="lg" className="space-y-3">
        <p className="text-base font-bold text-slate-700">
          Hasil: {outcome.correct} dari {outcome.total} jawaban benar.
          {outcome.skippedUnits.length > 0 && ` ${joinTitles(outcome.skippedUnits.map((u) => u.title))} dilewati.`}
        </p>
        <StartUnitLine outcome={outcome} />
        <p className="text-sm font-semibold text-slate-600">Tes penempatan hanya bisa diambil sekali.</p>
        <Link to="/" className={buttonClasses({ size: "lg" })}>
          Ke Beranda
        </Link>
      </Card>
    </div>
  );
}

function UnavailableView({ enabled }: { enabled: boolean }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="placement-unavailable">
      <PageHeader title="Tes penempatan" emoji="🧭" tone="sky" />
      <Card padding="lg" className="space-y-3">
        <p className="text-base font-bold text-slate-700">
          {enabled
            ? "Tes penempatan hanya untuk murid yang belum menyelesaikan satu pelajaran pun. Lanjutkan saja jalur belajarmu."
            : "Tes penempatan sedang tidak tersedia. Mulailah dari awal jalur belajarmu."}
        </p>
        <Link to="/" className={buttonClasses({ size: "lg" })}>
          Ke Beranda
        </Link>
      </Card>
    </div>
  );
}
