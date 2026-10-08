import type { ReactNode } from "react";
import { Brand } from "./ui/Brand";

const WIDTH = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" } as const;

export interface AuthCardProps {
  title: string;
  children: ReactNode;
  /** Tautan/teks pendukung di bawah kartu (mis. "Kembali ke halaman masuk"). */
  footer?: ReactNode;
  width?: keyof typeof WIDTH;
  /** Emoji dekoratif di atas judul (disembunyikan dari pembaca layar). */
  emoji?: string;
}

/** Huruf-huruf hiragana besar yang samar di latar (dekorasi murni). */
const KANA = [
  { char: "あ", className: "left-[3%] top-[6%] rotate-[-9deg] text-8xl lg:left-[47%] lg:top-[34%] lg:text-9xl" },
  { char: "い", className: "right-[9%] top-[10%] rotate-6 text-7xl" },
  { char: "う", className: "left-[38%] top-[2%] rotate-12 text-6xl" },
  { char: "え", className: "left-[8%] bottom-[10%] rotate-[10deg] text-7xl" },
  { char: "お", className: "right-[6%] bottom-[8%] rotate-[-6deg] text-8xl" },
  { char: "か", className: "left-[46%] bottom-[3%] rotate-[8deg] text-6xl" },
] as const;

const FEATURES = [
  { emoji: "🔥", text: "Streak harian" },
  { emoji: "🏆", text: "Peringkat mingguan" },
  { emoji: "🗣️", text: "Latihan percakapan" },
  { emoji: "🎴", text: "Flashcard pintar" },
] as const;

/** Bingkai halaman publik murid (masuk, undangan, lupa/reset password,
 * onboarding): latar gradien berhias hiragana, kartu putih di tengah, judul
 * sebagai satu-satunya `h1`. Panel sambutan di kiri hanya tampil di layar lebar
 * dan disembunyikan dari pembaca layar (`aria-hidden`) -- murni pemanis. */
export function AuthCard({ title, children, footer, width = "sm", emoji }: AuthCardProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary-700 via-secondary-700 to-tertiary-700">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
        <span className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-pink-400/30 blur-3xl" />
        <span className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-amber-300/25 blur-3xl" />
        <span className="absolute -top-20 left-1/3 h-64 w-64 rounded-full bg-sky-400/25 blur-3xl" />
        {KANA.map((k) => (
          <span
            key={k.char}
            className={`absolute font-black leading-none text-white/10 motion-safe:animate-float-slow ${k.className}`}
          >
            {k.char}
          </span>
        ))}
      </div>

      <main className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-12 px-4 py-8 lg:grid-cols-2 lg:px-10">
        <div aria-hidden="true" className="hidden lg:block">
          <Brand tone="dark" />
          <p className="mt-10 text-5xl font-black leading-[1.1] text-white">
            Belajar bahasa Jepang,
            <span className="block text-amber-300">selangkah demi selangkah.</span>
          </p>
          <p className="mt-5 max-w-md text-lg font-semibold text-white">
            Dari hiragana sampai percakapan sehari-hari: singkat, seru, dan bisa dibuka dari HP.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-3 rounded-2xl bg-black/15 p-3 ring-1 ring-white/25">
                <span className="text-2xl">{f.emoji}</span>
                <span className="text-sm font-extrabold text-white">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full">
          <Brand tone="dark" className="mb-6 justify-center lg:hidden" />
          <div
            className={`mx-auto w-full ${WIDTH[width]} space-y-5 rounded-[2rem] bg-white p-6 shadow-2xl shadow-primary-950/40 ring-1 ring-white/60 motion-safe:animate-pop-in md:p-8 lg:mx-0 lg:ml-auto`}
          >
            <div className="space-y-3">
              {emoji && (
                <span
                  aria-hidden="true"
                  className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-secondary-100 to-tertiary-100 text-3xl ring-1 ring-secondary-200"
                >
                  {emoji}
                </span>
              )}
              <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{title}</h1>
            </div>
            {children}
            {footer && <div className="border-t border-slate-100 pt-4 text-sm font-semibold text-slate-600">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
