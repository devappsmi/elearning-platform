import type { HTMLAttributes, ReactNode } from "react";

export type ChipTone = "amber" | "secondary" | "emerald" | "sky" | "pink" | "rose" | "slate" | "white";

// Semua pasangan latar/teks ≥ 4,5:1 (teks 800 di atas latar 100, atau putih di atas 600+).
const TONES: Record<ChipTone, string> = {
  amber: "bg-amber-100 text-amber-900 ring-amber-200",
  secondary: "bg-secondary-100 text-secondary-800 ring-secondary-200",
  emerald: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  sky: "bg-sky-100 text-sky-900 ring-sky-200",
  pink: "bg-pink-100 text-pink-900 ring-pink-200",
  rose: "bg-rose-100 text-rose-900 ring-rose-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  white: "bg-black/20 text-white ring-white/25",
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  children?: ReactNode;
}

/** Pil kecil untuk angka/label pendek (streak, XP, status). */
export function Chip({ tone = "slate", className, children, ...rest }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold ring-1 ring-inset ${TONES[tone]} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </span>
  );
}
