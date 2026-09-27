/** Titik satu node di jalur pelajaran. Tidak bergantung pada React/DOM. */
export interface NodePoint {
  dx: number;
  dy: number;
}

/** Menghitung posisi node sepanjang jalur berkelok (gaya peta permainan):
 * node genap di kiri titik tengah, node ganjil di kanan, jarak vertikal tetap.
 * Port dari lib/features/home/path_layout.dart. */
export const PathLayout = {
  compute({
    count,
    centerX,
    amplitude = 70,
    spacing = 104,
    topPadding = 48,
  }: {
    count: number;
    centerX: number;
    amplitude?: number;
    spacing?: number;
    topPadding?: number;
  }): NodePoint[] {
    const points: NodePoint[] = [];
    for (let i = 0; i < count; i++) {
      points.push({ dx: centerX + (i % 2 === 0 ? -amplitude : amplitude), dy: topPadding + i * spacing });
    }
    return points;
  },

  /** Tinggi total area yang dibutuhkan untuk menampung `count` node. */
  totalHeight(
    count: number,
    { spacing = 104, topPadding = 48, bottomPadding = 48 }: { spacing?: number; topPadding?: number; bottomPadding?: number } = {},
  ): number {
    return count === 0 ? 0 : topPadding + (count - 1) * spacing + bottomPadding;
  },

  /** Titik tengah antara node a dan b, dipakai untuk penanda milestone dekoratif. */
  midpoint(a: NodePoint, b: NodePoint): NodePoint {
    return { dx: (a.dx + b.dx) / 2, dy: (a.dy + b.dy) / 2 };
  },
};

/** String `d` SVG untuk garis lengkung yang menghubungkan node jalur --
 * padanan loop `path.cubicTo` di lib/features/home/path_connector_painter.dart
 * (tanpa CustomPainter Flutter; garis putus-putusnya sendiri cukup lewat CSS
 * `stroke-dasharray` di komponen SVG, tidak perlu port `_drawDashed` manual
 * yang jalan-metrik -- itu murni akal-akalan Canvas Flutter yang tidak
 * dibutuhkan lagi di web). Tiap segmen pakai midpoint-Y-nya sendiri sebagai Y
 * kedua titik kontrol, persis versi Dart-nya. */
export function buildConnectorPath(points: NodePoint[]): string {
  if (points.length < 2) return '';
  // `points.length >= 2` sudah dipastikan barusan -- index di bawah aman,
  // noUncheckedIndexedAccess tidak bisa membuktikan itu lewat guard length.
  const segments = [`M ${points[0]!.dx},${points[0]!.dy}`];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const midY = (prev.dy + curr.dy) / 2;
    segments.push(`C ${prev.dx},${midY} ${curr.dx},${midY} ${curr.dx},${curr.dy}`);
  }
  return segments.join(' ');
}
