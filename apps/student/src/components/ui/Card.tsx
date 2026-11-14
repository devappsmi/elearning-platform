import type { HTMLAttributes, ReactNode } from "react";

export type CardTone = "plain" | "primary" | "secondary" | "pink" | "amber" | "emerald" | "sky" | "rose";
export type CardPadding = "none" | "sm" | "md" | "lg";

// Kelas ditulis utuh (bukan disusun dari potongan) supaya terbaca oleh pemindai Tailwind.
const TONES: Record<CardTone, string> = {
  plain: "border-white bg-white",
  primary: "border-primary-100 bg-gradient-to-br from-primary-50 via-white to-white",
  secondary: "border-secondary-100 bg-gradient-to-br from-secondary-50 via-white to-white",
  pink: "border-pink-100 bg-gradient-to-br from-pink-50 via-white to-white",
  amber: "border-amber-100 bg-gradient-to-br from-amber-50 via-white to-white",
  emerald: "border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white",
  sky: "border-sky-100 bg-gradient-to-br from-sky-50 via-white to-white",
  rose: "border-rose-100 bg-gradient-to-br from-rose-50 via-white to-white",
};

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 md:p-6",
  lg: "p-6 md:p-8",
};

export interface CardProps extends HTMLAttributes<HTMLElement> {
  tone?: CardTone;
  padding?: CardPadding;
  as?: "div" | "section" | "article" | "aside" | "li";
  children?: ReactNode;
}

/** Kartu putih membulat dengan bayangan lembut berwarna; `tone` memberi semburat warna di sudut kiri-atas. */
export function Card({ tone = "plain", padding = "md", as: Tag = "div", className, children, ...rest }: CardProps) {
  const classes = ["rounded-3xl border shadow-card", TONES[tone], PADDING[padding], className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
