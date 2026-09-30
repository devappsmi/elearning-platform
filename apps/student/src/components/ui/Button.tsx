import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "success" | "sun" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

/** Tombol "timbul": ada tepi tebal di bawah yang ikut turun saat ditekan (rasa permainan, bukan formulir).
 * Teks putih hanya di atas warna yang kontrasnya ≥ 4,5:1 (primary/secondary/tertiary/emerald/rose 600-700);
 * varian `sun` (kuning) memakai teks gelap. Saat kursor di atasnya, varian berlatar gelap DIGELAPKAN sedikit
 * (`brightness-95`), bukan diterangkan: diterangkan membuat teks putih di ujung gradien turun di bawah 4,5:1. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-primary-600 via-secondary-600 to-tertiary-600 text-white shadow-[0_4px_0_0_theme(colors.secondary.900),0_12px_22px_-8px_theme(colors.secondary.700/55%)] hover:brightness-95",
  success:
    "bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-[0_4px_0_0_#064e3b,0_12px_22px_-8px_rgb(4_120_87_/_0.5)] hover:brightness-95",
  sun: "bg-gradient-to-b from-amber-300 to-amber-400 text-amber-950 shadow-[0_4px_0_0_#b45309,0_12px_22px_-8px_rgb(217_119_6_/_0.55)] hover:brightness-105",
  secondary:
    "border-2 border-slate-200 bg-white text-slate-700 shadow-[0_4px_0_0_#cbd5e1] hover:border-secondary-300 hover:bg-secondary-50 hover:text-secondary-800",
  danger:
    "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-[0_4px_0_0_#881337,0_12px_22px_-8px_rgb(225_29_72_/_0.5)] hover:brightness-95",
  ghost: "text-secondary-700 hover:bg-secondary-100",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 gap-1.5 rounded-xl px-3.5 py-1.5 text-sm",
  md: "min-h-11 gap-2 rounded-2xl px-5 py-2.5 text-base",
  lg: "min-h-14 gap-2.5 rounded-2xl px-7 py-3.5 text-lg",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Selebar wadahnya. */
  block?: boolean;
  className?: string;
}

/** Kelas tombol -- juga dipakai untuk tautan (`<Link className={buttonClasses()}>`) supaya tombol dan tautan
 * yang berperan sebagai tombol tampil sama TANPA membungkus `<button>` di dalam `<a>` (elemen interaktif bersarang). */
export function buttonClasses({ variant = "primary", size = "md", block, className }: ButtonStyleOptions = {}): string {
  return [
    "inline-flex select-none items-center justify-center text-center font-extrabold tracking-wide",
    "transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300 focus-visible:ring-offset-2",
    variant === "ghost"
      ? "active:scale-95"
      : "active:translate-y-1 active:shadow-none motion-reduce:active:translate-y-0",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    SIZES[size],
    VARIANTS[variant],
    block ? "w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, block, className })} {...props} />;
});

Button.displayName = "Button";

/** Tautan teks biasa (mis. "Lupa password?", "Kembali ke halaman masuk"). */
export const textLinkClasses =
  "font-extrabold text-secondary-700 underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-secondary-600";
