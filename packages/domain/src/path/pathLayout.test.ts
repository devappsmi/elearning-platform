import { describe, expect, test } from 'vitest';
import { buildConnectorPath, PathLayout } from './pathLayout';

// Port 1:1 dari test/features/home/path_layout_test.dart.

describe('PathLayout.compute', () => {
  test('node genap di kiri, ganjil di kanan titik tengah', () => {
    const points = PathLayout.compute({ count: 4, centerX: 150, amplitude: 60, spacing: 100, topPadding: 40 });
    expect(points).toHaveLength(4);
    expect(points[0]!.dx).toBe(90); // 150 - 60
    expect(points[1]!.dx).toBe(210); // 150 + 60
    expect(points[2]!.dx).toBe(90);
    expect(points[3]!.dx).toBe(210);
  });

  test('jarak vertikal antar node konsisten', () => {
    const points = PathLayout.compute({ count: 3, centerX: 100, spacing: 104, topPadding: 48 });
    expect(points[0]!.dy).toBe(48);
    expect(points[1]!.dy).toBe(152);
    expect(points[2]!.dy).toBe(256);
  });

  test('count nol menghasilkan list kosong', () => {
    expect(PathLayout.compute({ count: 0, centerX: 100 })).toEqual([]);
  });
});

describe('PathLayout.totalHeight', () => {
  test('menghitung tinggi termasuk padding atas dan bawah', () => {
    expect(PathLayout.totalHeight(3, { spacing: 100, topPadding: 40, bottomPadding: 40 })).toBe(280);
  });
  test('count nol menghasilkan tinggi nol', () => {
    expect(PathLayout.totalHeight(0)).toBe(0);
  });
});

describe('PathLayout.midpoint', () => {
  test('titik tengah dua node', () => {
    const a = { dx: 0, dy: 0 };
    const b = { dx: 100, dy: 50 };
    const m = PathLayout.midpoint(a, b);
    expect(m.dx).toBe(50);
    expect(m.dy).toBe(25);
  });
});

// Tidak ada test Dart untuk path_connector_painter.dart (butuh Canvas, cuma
// bisa diuji lewat widget/golden test) -- kasus di sini dihitung manual dari
// rumus midpoint-Y yang sama persis dengan loop cubicTo di versi Dart-nya.
describe('buildConnectorPath', () => {
  test('kurang dari 2 titik menghasilkan string kosong', () => {
    expect(buildConnectorPath([])).toBe('');
    expect(buildConnectorPath([{ dx: 0, dy: 0 }])).toBe('');
  });

  test('dua titik: satu kurva kubik, midY = rata-rata dy', () => {
    const path = buildConnectorPath([
      { dx: 10, dy: 0 },
      { dx: 90, dy: 100 },
    ]);
    expect(path).toBe('M 10,0 C 10,50 90,50 90,100');
  });

  test('tiga titik: dua segmen berurutan', () => {
    const path = buildConnectorPath([
      { dx: 10, dy: 0 },
      { dx: 90, dy: 100 },
      { dx: 10, dy: 200 },
    ]);
    expect(path).toBe('M 10,0 C 10,50 90,50 90,100 C 90,150 10,150 10,200');
  });
});
