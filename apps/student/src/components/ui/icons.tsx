import type { ReactNode, SVGProps } from "react";

/** Ikon garis 24×24 (warna ikut `currentColor`). Sengaja dibuat sendiri (bukan pustaka) supaya tanpa dependensi
 * tambahan dan ukurannya kecil; semuanya dekoratif (`aria-hidden`) -- teks/label yang menjelaskan maknanya. */
const PATHS = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.2a.8.8 0 0 0 .8.8H10v-5.5h4V20h3.7a.8.8 0 0 0 .8-.8V10" />
    </>
  ),
  chat: (
    <>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.6A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="M8.5 10.5h7M8.5 13.8h4.2" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.6A2.6 2.6 0 0 1 7.1 3H19.5v15.5H7.1a2.6 2.6 0 0 0-2.6 2.5V5.6Z" />
      <path d="M8.5 7.5h7M8.5 11h4" />
    </>
  ),
  cards: (
    <>
      <rect x="3" y="8" width="13.5" height="12" rx="2.6" />
      <path d="M7.5 4.5h10.8A2.7 2.7 0 0 1 21 7.2v8.6" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5.2a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5.2a.7.7 0 0 0-.7.8A3.9 3.9 0 0 0 8 10.3M16 6h2.8a.7.7 0 0 1 .7.8A3.9 3.9 0 0 1 16 10.3" />
      <path d="M12 13.2v3.6M8.5 20h7M9.8 16.8h4.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.2a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4.5h3A2 2 0 0 1 19.5 6.5v11a2 2 0 0 1-2 2h-3" />
      <path d="M10 8.2 6.2 12l3.8 3.8M6.5 12h9" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.8" width="14" height="9.2" rx="2.6" />
      <path d="M8.2 10.8V8a3.8 3.8 0 0 1 7.6 0v2.8" />
    </>
  ),
  check: <path d="m5.2 12.6 4.4 4.4L18.8 7.6" />,
  x: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.8" />
      <path d="m20 20-3.9-3.9" />
    </>
  ),
  speaker: (
    <>
      <path d="M11 5.2 6.6 8.9H3.5v6.2h3.1L11 18.8V5.2Z" />
      <path d="M15.2 9a4.2 4.2 0 0 1 0 6M18 6.3a8 8 0 0 1 0 11.4" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  refresh: (
    <>
      <path d="M19.8 11.2A7.8 7.8 0 1 0 17.6 16.8" />
      <path d="M19.8 4.8v6.4h-6.4" />
    </>
  ),
  sparkles: (
    <>
      <path d="m11 3.5 1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6L4.7 9.8l4.6-1.7L11 3.5Z" />
      <path d="m18.5 14.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r=".8" fill="currentColor" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.6 2.9 19.3a1 1 0 0 0 .9 1.5h16.4a1 1 0 0 0 .9-1.5L12 3.6Z" />
      <path d="M12 10v4.2M12 17.4v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.2M12 7.8v.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

/** Ikon isi penuh (tidak digambar sebagai garis). */
const FILLED = {
  star: <path d="m12 2.8 2.75 5.6 6.15.9-4.45 4.35 1.05 6.15L12 16.9l-5.5 2.9 1.05-6.15L3.1 9.3l6.15-.9L12 2.8Z" />,
  bolt: <path d="M13.4 2 4.6 13.6a.6.6 0 0 0 .5 1H10l-1.2 7.1a.4.4 0 0 0 .7.3l8.9-11.6a.6.6 0 0 0-.5-1H13l1.2-7a.4.4 0 0 0-.8-.4Z" />,
  play: <path d="M8.2 4.9v14.2a.9.9 0 0 0 1.4.8l10.6-7.1a.9.9 0 0 0 0-1.5L9.6 4.1a.9.9 0 0 0-1.4.8Z" />,
  heart: <path d="M12 20.6 4.2 13A5 5 0 0 1 12 6.5 5 5 0 0 1 19.8 13L12 20.6Z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS | keyof typeof FILLED;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "children"> {
  name: IconName;
  /** Tebal garis untuk ikon garis (bawaan 2). */
  strokeWidth?: number;
}

export function Icon({ name, className = "h-6 w-6", strokeWidth = 2, ...rest }: IconProps) {
  const filled = name in FILLED;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {filled ? FILLED[name as keyof typeof FILLED] : PATHS[name as keyof typeof PATHS]}
    </svg>
  );
}
