import { useState } from "react";

// Pasangan warna 600-700 (kontras dengan huruf putih); dipilih dari nama supaya satu murid selalu berwarna sama.
const GRADIENTS = [
  "from-primary-600 to-secondary-600",
  "from-tertiary-600 to-secondary-600",
  "from-pink-600 to-rose-600",
  "from-orange-600 to-rose-600",
  "from-teal-600 to-emerald-700",
  "from-sky-600 to-primary-600",
  "from-cyan-700 to-blue-700",
];

const SIZES = {
  sm: "h-9 w-9 text-sm",
  md: "h-11 w-11 text-base",
  lg: "h-16 w-16 text-2xl",
  xl: "h-24 w-24 text-4xl",
} as const;

/** Dua huruf awal (kata pertama dan terakhir) dalam huruf besar; kosong -> "?". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (first === undefined) return "?";
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const initial = (word: string) => Array.from(word)[0] ?? "";
  return (initial(first) + (last === undefined ? "" : initial(last))).toUpperCase();
}

function gradientFor(name: string): string {
  let sum = 0;
  for (const ch of name) sum = (sum + (ch.codePointAt(0) ?? 0)) % 9973;
  return GRADIENTS[sum % GRADIENTS.length] ?? "from-primary-600 to-secondary-600";
}

export interface AvatarProps {
  name: string;
  /** Foto profil; bila gagal dimuat, kembali ke huruf awal. */
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Lingkaran berisi foto atau huruf awal. Dekoratif (`aria-hidden`): namanya selalu tertulis di dekatnya. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const base = `inline-grid shrink-0 place-items-center rounded-full font-extrabold text-white ring-2 ring-white/70 shadow-md ${SIZES[size]}`;

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        onError={() => setBroken(true)}
        className={`${base} object-cover ${className ?? ""}`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`${base} bg-gradient-to-br ${gradientFor(name)} ${className ?? ""}`}>
      {initialsOf(name)}
    </span>
  );
}
