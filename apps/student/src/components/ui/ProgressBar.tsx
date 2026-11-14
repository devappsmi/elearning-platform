import type { HTMLAttributes } from "react";

export type ProgressTone = "brand" | "emerald" | "amber" | "sky" | "pink";
export type ProgressSize = "sm" | "md" | "lg";

const FILL: Record<ProgressTone, string> = {
  brand: "from-primary-500 via-secondary-500 to-tertiary-500",
  emerald: "from-emerald-400 to-teal-500",
  amber: "from-amber-300 to-orange-500",
  sky: "from-sky-400 to-primary-500",
  pink: "from-pink-400 to-rose-500",
};

const HEIGHT: Record<ProgressSize, string> = { sm: "h-2", md: "h-3", lg: "h-4" };

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  value: number;
  max?: number;
  /** Nama untuk pembaca layar (mis. "Kemajuan pelajaran"). */
  label: string;
  tone?: ProgressTone;
  size?: ProgressSize;
  /** Untuk dipasang di atas latar berwarna gelap (mis. kartu sapaan): jalur transparan keputihan. */
  onDark?: boolean;
}

/** Batang kemajuan bulat dengan gradien; nilai dijepit ke 0..max dan diumumkan lewat `role="progressbar"`. */
export function ProgressBar({
  value,
  max = 100,
  label,
  tone = "brand",
  size = "md",
  onDark = false,
  className,
  ...rest
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(safeMax, Math.max(0, Number.isFinite(value) ? value : 0));
  const pct = (clamped / safeMax) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      className={`overflow-hidden rounded-full ring-1 ring-inset ${
        onDark ? "bg-white/25 ring-white/25" : "bg-slate-200/80 ring-slate-300/40"
      } ${HEIGHT[size]} ${className ?? ""}`}
      {...rest}
    >
      <div
        className={`h-full rounded-full bg-gradient-to-r ${FILL[tone]} transition-[width] duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
