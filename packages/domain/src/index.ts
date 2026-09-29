/** Barrel publik @elearning/domain -- re-export seluruh modul hasil port dari
 * webapp/src/domain/**, dikelompokkan menurut struktur folder di
 * packages/domain/src/. Lihat README/plan untuk pemetaan lengkap
 * source -> destination. */

// auth: kebijakan password AUTH-02 (dipakai bersama server + form murid)
export * from './auth/passwordPolicy';

// content: skema zod + tipe konten (Unit/Lesson/Exercise/Vocab/Sentence)
export * from './content/types';

// exercises: bentuk PreparedExercise siap tampil + factory-nya
export * from './exercises/preparedExercise';
export * from './exercises/exerciseFactory';

// lesson: menjalankan antrean latihan satu pelajaran
export * from './lesson/lessonSession';

// path: layout jalur belajar, aturan unlock, sapaan maskot
export * from './path/mascotMessage';
export * from './path/pathLayout';
export * from './path/unitPathLayout';
export * from './path/unlockRules';

// gamification: XP, streak, badge
export * from './gamification/types';
export * from './gamification/xpService';
export * from './gamification/streakService';
export * from './gamification/badgeService';
export * from './gamification/badgeCatalog';

// srs: statistik repetisi kata/kalimat
export * from './srs/wordRepetitionService';

// scenario: skema + sesi latihan percakapan ber-template (CONV-01..04)
export * from './scenario/types';
export * from './scenario/scenarioSession';

// shared: utilitas tanggal, angka, RNG
export * from './shared/dates';
export * from './shared/math';
export * from './shared/random';

// text: normalisasi teks Jepang + kemiripan string
export * from './text/japaneseText';
