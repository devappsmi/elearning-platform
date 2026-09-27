import type { Unit } from '../content/types';
import { BadgeService } from './badgeService';

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
}

const STATIC_BADGES: BadgeDef[] = [
  { id: BadgeService.firstLesson, title: 'Langkah pertama', description: 'Selesaikan pelajaran pertama' },
  { id: BadgeService.streak7, title: 'Seminggu penuh', description: 'Streak 7 hari' },
  { id: BadgeService.streak30, title: 'Sebulan penuh', description: 'Streak 30 hari' },
  { id: BadgeService.hiraganaMaster, title: 'Master Hiragana', description: 'Tuntaskan unit Hiragana' },
  { id: BadgeService.katakanaMaster, title: 'Master Katakana', description: 'Tuntaskan unit Katakana' },
  { id: BadgeService.words100, title: '100 kata', description: 'Pelajari 100 kata' },
  { id: BadgeService.speaker50, title: 'Pembicara andal', description: 'Skor 80 ke atas pada 50 latihan speak' },
];

/** Daftar lencana untuk ditampilkan di UI. Lencana unit dibuat dari daftar unit.
 * Port dari lib/features/progress/badge_catalog.dart. */
export const BadgeCatalog = {
  all(units: Unit[]): BadgeDef[] {
    const unitBadges: BadgeDef[] = units
      .filter((u) => u.type === 'conversation')
      .map((u) => ({
        id: BadgeService.unitBadge(u.id),
        title: `Tuntas: ${u.title}`,
        description: `Selesaikan semua pelajaran di unit ${u.title}`,
      }));
    return [...STATIC_BADGES, ...unitBadges];
  },

  find(units: Unit[], id: string): BadgeDef | undefined {
    return BadgeCatalog.all(units).find((b) => b.id === id);
  },
};
