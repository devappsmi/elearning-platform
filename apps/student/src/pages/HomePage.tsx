import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { components } from "@elearning/api-client";
import { apiClient } from "../auth/api-client";
import { useAuth } from "../auth/AuthContext";
import { buttonClasses } from "../components/ui/Button";
import { Loading, Notice } from "../components/ui/Feedback";
import { Icon } from "../components/ui/icons";
import { ProgressBar } from "../components/ui/ProgressBar";

type PathView = components["schemas"]["PathView"];
type PathUnit = components["schemas"]["PathUnitView"];
type PathLesson = components["schemas"]["PathLessonView"];

/** Warna tiap unit (berganti-ganti). `banner`: spanduk (teks putih ≥ 4,5:1); `node`+`edge`: bulatan pelajaran yang
 * tersedia dengan tepi "timbul"; `pulse`: warna denyut pada pelajaran yang sedang dikerjakan. Ditulis utuh untuk Tailwind. */
const THEMES = [
  {
    banner: "from-primary-600 via-secondary-600 to-tertiary-600",
    node: "from-secondary-500 to-primary-600",
    edge: "shadow-[0_6px_0_0_theme(colors.primary.800)]",
    pulse: "shadow-[0_0_0_0_theme(colors.primary.500/55%)]",
  },
  {
    banner: "from-fuchsia-600 via-pink-600 to-rose-600",
    node: "from-pink-500 to-rose-600",
    edge: "shadow-[0_6px_0_0_#9f1239]",
    pulse: "shadow-[0_0_0_0_rgb(244_63_94_/_0.55)]",
  },
  {
    banner: "from-teal-700 via-emerald-700 to-green-700",
    node: "from-teal-500 to-emerald-600",
    edge: "shadow-[0_6px_0_0_#065f46]",
    pulse: "shadow-[0_0_0_0_rgb(16_185_129_/_0.55)]",
  },
  {
    banner: "from-sky-700 via-blue-700 to-primary-700",
    node: "from-sky-500 to-blue-600",
    edge: "shadow-[0_6px_0_0_#1e40af]",
    pulse: "shadow-[0_0_0_0_rgb(59_130_246_/_0.55)]",
  },
  {
    banner: "from-amber-700 via-orange-700 to-red-700",
    node: "from-orange-500 to-red-600",
    edge: "shadow-[0_6px_0_0_#991b1b]",
    pulse: "shadow-[0_0_0_0_rgb(249_115_22_/_0.55)]",
  },
] as const;

const LOCKED_BANNER = "from-slate-500 to-slate-600";

/** Hiasan di kiri/kanan jalur (hanya layar lebar), berganti per unit. */
const SCENERY = [
  ["🌸", "⛩️", "🗻"],
  ["🍙", "🎏", "🎋"],
  ["🍵", "🏮", "🐟"],
] as const;

/** Pola gelombang jalur: langkah ke kanan (+) / kiri (−) per pelajaran, lalu berulang. */
const WAVE = [0, 1, 2, 1, 0, -1, -2, -1] as const;

/** Beranda (S-home PRD) -- peta jalur belajar dari GET /path (LearningPathModule,
 * sudah ada+teruji sejak Milestone 7). Lesson terkunci dirender non-interaktif
 * (server tetap jadi penegak sesungguhnya lewat 403 di POST /lessons/:id/attempts,
 * lihat lessons.service.ts -- ini murni supaya murid tidak coba klik ke lesson
 * yang jelas belum waktunya). */
export function HomePage() {
  const { me } = useAuth();
  const [path, setPath] = useState<PathView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.GET("/path").then(({ data, error: apiError }) => {
      if (cancelled) return;
      if (apiError || !data) {
        setError("Gagal memuat jalur belajar.");
        return;
      }
      setPath(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!path) return <Loading />;

  const units = path.levels.flatMap((level) => level.units);
  const totalLessons = units.reduce((sum, unit) => sum + unit.totalLessons, 0);
  const doneLessons = units.reduce((sum, unit) => sum + unit.completedLessons, 0);
  const allDone = totalLessons > 0 && doneLessons >= totalLessons;
  let unitIndex = 0; // hanya untuk menggilir warna spanduk; nomor yang tampil adalah `unit.order` (nomor dari penulis konten)

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-600 via-secondary-600 to-tertiary-600 p-6 text-white shadow-glow md:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden">
          <span className="absolute -right-4 -top-12 text-[11rem] font-black leading-none text-white/10 md:text-[14rem]">
            あ
          </span>
          <span className="absolute bottom-3 right-40 hidden text-4xl motion-safe:animate-float lg:block">🌸</span>
          <span className="absolute right-24 top-6 text-2xl opacity-80 motion-safe:animate-float-slow lg:right-72">✨</span>
          <span className="absolute -bottom-2 right-1/3 hidden text-3xl opacity-70 motion-safe:animate-float-slow lg:block">
            🌸
          </span>
        </div>

        <div className="relative">
          <p className="text-sm font-extrabold tracking-widest text-white">こんにちは！</p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-white md:text-4xl">
            Selamat datang, <span className="whitespace-nowrap">{me.name}</span>
          </h1>

          <div className="mt-5 flex flex-wrap gap-3">
            <div className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-2.5 ring-1 ring-white/25">
              <span aria-hidden="true" className="text-3xl motion-safe:animate-flicker">
                🔥
              </span>
              <p className="text-sm font-bold text-white">
                Streak
                <span className="block text-xl font-black leading-tight text-white">
                  {path.streak.current} <span className="text-sm font-bold">hari</span>
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-2.5 ring-1 ring-white/25">
              <span aria-hidden="true" className="text-3xl">
                🏆
              </span>
              <p className="text-sm font-bold text-white">
                Terpanjang
                <span className="block text-xl font-black leading-tight text-white">
                  {path.streak.longest} <span className="text-sm font-bold">hari</span>
                </span>
              </p>
            </div>
            {totalLessons > 0 && (
              <div className="flex min-w-[10rem] flex-1 flex-col justify-center gap-1.5 rounded-2xl bg-black/20 px-4 py-2.5 ring-1 ring-white/25 md:max-w-xs">
                <p className="flex items-baseline justify-between text-sm font-bold text-white">
                  Pelajaran selesai
                  <span className="text-lg font-black text-white">
                    {doneLessons}/{totalLessons}
                  </span>
                </p>
                <ProgressBar value={doneLessons} max={totalLessons} label="Kemajuan belajar" tone="amber" size="sm" onDark />
              </div>
            )}
          </div>

          {path.continueLessonId ? (
            <Link
              to={`/learn/${path.continueLessonId}`}
              className={buttonClasses({ variant: "sun", size: "lg", className: "mt-6 w-full sm:w-auto" })}
            >
              Lanjutkan Belajar
              <Icon name="arrowRight" className="h-5 w-5" strokeWidth={2.6} />
            </Link>
          ) : (
            allDone && <p className="mt-6 text-lg font-extrabold text-white">Hebat! Semua pelajaran sudah selesai 🎉</p>
          )}
        </div>
      </section>

      {path.levels.length === 0 && <Notice tone="info">Belum ada pelajaran untuk kelasmu.</Notice>}

      {path.levels.map((level) => (
        <section key={level.id} className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 md:text-2xl">
            <span aria-hidden="true" className="h-6 w-1.5 rounded-full bg-gradient-to-b from-secondary-500 to-tertiary-500" />
            {level.name}
          </h2>
          {level.units.map((unit) => {
            const index = unitIndex++;
            return (
              <UnitPath
                key={unit.id}
                unit={unit}
                number={unit.order}
                themeIndex={index}
                continueLessonId={path.continueLessonId}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}

interface UnitPathProps {
  unit: PathUnit;
  number: number;
  themeIndex: number;
  continueLessonId: string | null;
}

function UnitPath({ unit, number, themeIndex, continueLessonId }: UnitPathProps) {
  const theme = THEMES[themeIndex % THEMES.length] ?? THEMES[0];
  const scenery = SCENERY[themeIndex % SCENERY.length] ?? SCENERY[0];
  const banner = unit.unlocked ? theme.banner : LOCKED_BANNER;

  return (
    <div className={`overflow-hidden rounded-3xl border border-white bg-white/80 shadow-card ${unit.unlocked ? "" : "opacity-90"}`}>
      <div className={`relative overflow-hidden bg-gradient-to-r ${banner} px-5 py-4 text-white md:px-6`}>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -top-6 select-none text-8xl font-black leading-none text-white/10"
        >
          {unit.type === "kana" ? "あ" : "💬"}
        </span>
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white">Unit {number}</p>
            <h3 className="text-balance text-xl font-black leading-tight text-white">{unit.title}</h3>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-sm font-extrabold ring-1 ring-white/30">
            {!unit.unlocked && <Icon name="lock" className="h-4 w-4" />}
            {unit.completedLessons}/{unit.totalLessons}
          </span>
        </div>
        <ProgressBar
          value={unit.completedLessons}
          max={unit.totalLessons}
          label={`Kemajuan ${unit.title}`}
          tone="amber"
          size="sm"
          onDark
          className="relative mt-3"
        />
      </div>

      <div className="relative bg-[radial-gradient(circle_at_1px_1px,theme(colors.secondary.500/13%)_1px,transparent_0)] [background-size:22px_22px]">
        <div aria-hidden="true" className="pointer-events-none hidden select-none lg:block">
          <span className="absolute left-[9%] top-[14%] text-4xl opacity-80 motion-safe:animate-float-slow">{scenery[0]}</span>
          <span className="absolute right-[10%] top-[42%] text-5xl opacity-80 motion-safe:animate-float">{scenery[1]}</span>
          <span className="absolute bottom-[10%] left-[14%] text-5xl opacity-80 motion-safe:animate-float-slow">{scenery[2]}</span>
        </div>
        <ol className="relative flex flex-col items-center gap-6 px-4 pb-8 pt-12">
          {unit.lessons.map((lesson, i) => (
            // Pelajaran yang sedang dikerjakan diberi ruang ekstra di atas untuk gelembung "MULAI".
            <li key={lesson.id} className={lesson.id === continueLessonId ? "mt-9" : undefined}>
              <LessonNode lesson={lesson} index={i} themeIndex={themeIndex} current={lesson.id === continueLessonId} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

interface LessonNodeProps {
  lesson: PathLesson;
  index: number;
  themeIndex: number;
  current: boolean;
}

const TRAILING_JAPANESE_PATTERN_RE = /^(.*\S)\s*(\([^()]*[\u3040-\u30ff\u3400-\u9fff][^()]*\))$/;

/** Judul pelajaran di jalur belajar. Judul yang berakhiran pola Jepang dalam kurung ("Keadaan Sedang Berlangsung (～ている)") dipecah:
 *  nama di satu baris, pola di baris sendiri -- supaya pola tidak terpotong di tengah ("～てい / る"). */
function LessonTitle({ title }: { title: string }) {
  const match = TRAILING_JAPANESE_PATTERN_RE.exec(title);
  if (!match) return <>{title}</>;
  return (
    <>
      {match[1]}{" "}
      <span lang="ja" className="block [overflow-wrap:anywhere]">
        {match[2]}
      </span>
    </>
  );
}

function LessonNode({ lesson, index, themeIndex, current }: LessonNodeProps) {
  const theme = THEMES[themeIndex % THEMES.length] ?? THEMES[0];
  const wave = WAVE[index % WAVE.length] ?? 0;
  // --dx: gelombang sempit (HP/tablet); --dx-md: gelombang lebar, dipakai mulai layar lg (kolom isi cukup lebar).
  const shift = { "--dx": `${wave * 30}px`, "--dx-md": `${wave * 64}px` } as CSSProperties;
  const stars = lesson.stars ?? 0;
  const size = lesson.isCheckpoint ? "h-20 w-20" : "h-[4.5rem] w-[4.5rem]";

  let face: string;
  let icon: "lock" | "check" | "play" | "trophy" | "star";
  if (lesson.state === "locked") {
    face = "from-slate-200 to-slate-300 text-slate-500 shadow-[0_6px_0_0_#94a3b8]";
    icon = "lock";
  } else if (lesson.state === "done") {
    face = "from-amber-300 to-amber-400 text-amber-900 shadow-[0_6px_0_0_#b45309]";
    icon = lesson.isCheckpoint ? "trophy" : "star";
  } else {
    face = `${theme.node} text-white ${theme.edge}`;
    icon = lesson.isCheckpoint ? "trophy" : "play";
  }

  const body = (
    <>
      <span className="relative">
        {current && (
          <>
            <span
              aria-hidden="true"
              className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1 text-xs font-black tracking-wider text-secondary-700 shadow-lg ring-1 ring-secondary-100 motion-safe:animate-float"
            >
              MULAI
              <span className="absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-sm bg-white" />
            </span>
            <span aria-hidden="true" className={`absolute inset-0 rounded-full motion-safe:animate-ring-pulse ${theme.pulse}`} />
          </>
        )}
        <span
          className={`relative grid place-items-center rounded-full bg-gradient-to-b transition duration-150 group-active:translate-y-1.5 group-active:shadow-none ${size} ${face}`}
        >
          <Icon name={icon} className={lesson.isCheckpoint ? "h-9 w-9" : "h-8 w-8"} strokeWidth={2.4} />
        </span>
      </span>
      {lesson.state === "done" && (
        <span aria-hidden="true" className="flex gap-0.5">
          {[0, 1, 2].map((n) => (
            <Icon key={n} name="star" className={`h-4 w-4 ${n < stars ? "text-amber-400" : "text-slate-300"}`} />
          ))}
        </span>
      )}
      <span
        className={`max-w-[9.5rem] text-center text-sm font-extrabold leading-snug ${
          lesson.state === "locked" ? "text-slate-500" : "text-slate-800"
        }`}
      >
        <LessonTitle title={lesson.title} />
        <span className="sr-only">
          {lesson.state === "locked" ? ", terkunci" : lesson.state === "done" ? `, selesai, ${stars} bintang` : ", tersedia"}
        </span>
      </span>
    </>
  );

  const shared = "group flex translate-x-[var(--dx)] flex-col items-center gap-2 lg:translate-x-[var(--dx-md)]";
  if (lesson.state === "locked") {
    return (
      <div title="Terkunci" aria-disabled="true" style={shift} className={`${shared} cursor-not-allowed`}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to={`/learn/${lesson.id}`}
      style={shift}
      className={`${shared} rounded-3xl px-2 pb-1 pt-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300`}
    >
      {body}
    </Link>
  );
}
