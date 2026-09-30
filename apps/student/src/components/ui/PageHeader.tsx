import type { ReactNode } from "react";

export type HeaderTone = "violet" | "pink" | "emerald" | "sky" | "amber" | "rose";

// Ubin ikon berwarna pastel di sisi judul (emoji-nya sendiri sudah berwarna).
const TILE: Record<HeaderTone, string> = {
  violet: "from-violet-100 to-fuchsia-100 ring-violet-200",
  pink: "from-pink-100 to-rose-100 ring-pink-200",
  emerald: "from-emerald-100 to-teal-100 ring-emerald-200",
  sky: "from-sky-100 to-indigo-100 ring-sky-200",
  amber: "from-amber-100 to-orange-100 ring-amber-200",
  rose: "from-rose-100 to-orange-100 ring-rose-200",
};

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  emoji?: string;
  tone?: HeaderTone;
  /** Isi di sisi kanan (mis. tombol/keterangan). */
  aside?: ReactNode;
  /** Tingkat judul: `h1` (bawaan) atau `h2` bila halaman sudah punya `h1` sendiri. */
  as?: "h1" | "h2";
}

/** Kepala halaman: ubin emoji + judul tebal + keterangan singkat. */
export function PageHeader({ title, subtitle, emoji, tone = "violet", aside, as: Heading = "h1" }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 motion-safe:animate-slide-up">
      {emoji && (
        <span
          aria-hidden="true"
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-3xl shadow-card ring-1 ${TILE[tone]}`}
        >
          {emoji}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Heading className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{title}</Heading>
        {subtitle && <p className="mt-0.5 text-sm font-semibold text-slate-600 md:text-base">{subtitle}</p>}
      </div>
      {aside}
    </header>
  );
}
