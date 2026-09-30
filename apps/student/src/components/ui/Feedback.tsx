import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "./icons";
import type { IconName } from "./icons";

export type NoticeTone = "error" | "success" | "info" | "warning";

// Pasangan latar/teks ≥ 4,5:1 (teks 900 di atas latar 50). Ikonnya SVG (bukan emoji) supaya `textContent`
// pesan tetap persis teksnya -- pembaca layar dan tes membaca isi `role="alert"`/`"status"` apa adanya.
const NOTICE: Record<NoticeTone, { box: string; badge: string; icon: IconName }> = {
  error: { box: "border-rose-200 bg-rose-50 text-rose-900", badge: "bg-rose-200 text-rose-800", icon: "alert" },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", badge: "bg-emerald-200 text-emerald-800", icon: "check" },
  info: { box: "border-sky-200 bg-sky-50 text-sky-900", badge: "bg-sky-200 text-sky-800", icon: "info" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", badge: "bg-amber-200 text-amber-900", icon: "clock" },
};

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  tone?: NoticeTone;
  children: ReactNode;
}

/** Pesan singkat berwarna (galat, berhasil, info). Beri `role="alert"`/`"status"` dari pemanggil bila perlu diumumkan. */
export function Notice({ tone = "info", className, children, ...rest }: NoticeProps) {
  const t = NOTICE[tone];
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 text-sm font-bold ${t.box} ${className ?? ""}`}
      {...rest}
    >
      <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${t.badge}`}>
        <Icon name={t.icon} className="h-4 w-4" strokeWidth={2.6} />
      </span>
      <div className="min-w-0 flex-1 self-center">{children}</div>
    </div>
  );
}

/** Penanda "sedang memuat" (kelopak sakura yang memantul). Teksnya tetap "Memuat..." untuk pembaca layar. */
export function Loading({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="grid place-items-center gap-3 py-20 text-center">
      <span aria-hidden="true" className="text-5xl motion-safe:animate-bounce">
        🌸
      </span>
      <p role="status" className="text-base font-extrabold text-violet-700">
        {label}
      </p>
    </div>
  );
}
