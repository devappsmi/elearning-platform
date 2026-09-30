export interface BrandProps {
  /** `light`: teks gelap di atas latar terang; `dark`: teks putih di atas latar berwarna (sidebar). */
  tone?: "light" | "dark";
  /** `sm`: versi ringkas untuk bilah atas di HP. */
  size?: "md" | "sm";
  className?: string;
}

/** Lambang aplikasi: ubin "matahari sakura" bertuliskan あ (huruf pertama hiragana) + nama aplikasi. */
export function Brand({ tone = "light", size = "md", className }: BrandProps) {
  const dark = tone === "dark";
  const small = size === "sm";
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 font-black text-white shadow-lg shadow-rose-900/25 ring-2 ring-white/50 ${small ? "h-9 w-9 text-xl" : "h-11 w-11 text-2xl"}`}
      >
        あ
      </span>
      <span className="whitespace-nowrap leading-tight">
        <span
          className={`block font-extrabold uppercase tracking-[0.18em] ${small ? "text-[10px]" : "text-[11px]"} ${dark ? "text-white" : "text-secondary-700"}`}
        >
          Belajar
        </span>
        <span className={`block font-black ${small ? "text-base" : "text-lg"} ${dark ? "text-white" : "text-slate-900"}`}>
          Bahasa Jepang
        </span>
      </span>
    </div>
  );
}
