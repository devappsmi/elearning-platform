import type { CSSProperties } from "react";

const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#ec4899", "#facc15"] as const;

// Deterministik (tanpa Math.random): posisi/waktu/warna dihitung dari nomor urut supaya tampilannya stabil.
const PIECES = Array.from({ length: 34 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (((i * 53) % 100) / 100) * 1.1,
  duration: 2.6 + (((i * 29) % 100) / 100) * 1.6,
  dx: ((i * 61) % 160) - 80,
  rot: 360 + ((i * 47) % 540),
  width: 6 + (i % 4) * 2,
  height: 10 + (i % 3) * 4,
  round: i % 5 === 0,
  color: COLORS[i % COLORS.length],
}));

/** Hujan konfeti untuk perayaan (lulus pelajaran/percakapan). Dekoratif (`aria-hidden`), tak menghalangi klik,
 * dan hanya tampil bila pengguna tidak meminta gerakan dikurangi (`motion-safe`). */
export function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 hidden overflow-hidden motion-safe:block">
      {PIECES.map((c, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti"
          style={
            {
              left: `${c.left}%`,
              width: c.width,
              height: c.height,
              backgroundColor: c.color,
              borderRadius: c.round ? "9999px" : "2px",
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              "--dx": `${c.dx}px`,
              "--rot": `${c.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
