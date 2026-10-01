import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { findVocabById, grammarNoteSchema, unitSchema } from './types';

// Parse konten Hiragana sungguhan (bukan fixture buatan) supaya skema zod
// benar-benar tervalidasi terhadap output tools/gen_hiragana.py, bukan cuma
// bentuk yang saya kira benar. Fixture ini adalah salinan byte-identik dari
// webapp/public/content/unit_hiragana.json (repo lama) -- disalin ke sini
// karena packages/domain adalah repo terpisah dan tidak boleh bergantung pada
// path di repo webapp. Salinan "resmi" untuk seed database ada di
// apps/api/prisma/seed-data/raw/ (dikerjakan di milestone migrasi konten,
// bukan di sini); salinan test ini murni untuk memvalidasi skema.
describe('unitSchema terhadap __fixtures__/unit_hiragana.json', () => {
  const raw = JSON.parse(readFileSync(join(__dirname, '__fixtures__/unit_hiragana.json'), 'utf-8'));

  test('parse tanpa error dan hasilnya sesuai docs/features.md', () => {
    const unit = unitSchema.parse(raw);
    expect(unit.id).toBe('unit_hiragana');
    expect(unit.type).toBe('kana');
    expect(unit.lessons).toHaveLength(7);
    expect(unit.vocab).toHaveLength(104);
    expect(unit.sentences).toHaveLength(56);
  });

  test('field snake_case dipetakan ke camelCase', () => {
    const unit = unitSchema.parse(raw);
    const v = unit.vocab[0];
    expect(v).toHaveProperty('meaning');
    expect(v).not.toHaveProperty('meaning_id');
    const s = unit.sentences[0];
    expect(s).toHaveProperty('assembleTokens');
    expect(s).not.toHaveProperty('assemble_tokens');
  });

  test('findVocabById menemukan vocab yang benar-benar ada', () => {
    const unit = unitSchema.parse(raw);
    const firstId = unit.vocab[0]!.id;
    expect(findVocabById(unit, firstId)?.id).toBe(firstId);
    expect(findVocabById(unit, 'tidak-ada')).toBeUndefined();
  });
});

describe('grammarNoteSchema', () => {
  test('lesson_id opsional dipetakan ke lessonId (catatan yang ditautkan ke satu pelajaran)', () => {
    const note = grammarNoteSchema.parse({ id: 'g1', title: 'Judul', body_md: 'Isi', lesson_id: 'l1' });
    expect(note).toEqual({ id: 'g1', title: 'Judul', bodyMd: 'Isi', lessonId: 'l1' });
  });

  test('tanpa lesson_id (atau null): tidak ada kunci lessonId sama sekali -- catatan lama tidak berubah bentuk', () => {
    expect(grammarNoteSchema.parse({ id: 'g1', title: 'Judul', body_md: 'Isi' })).toStrictEqual({ id: 'g1', title: 'Judul', bodyMd: 'Isi' });
    expect(grammarNoteSchema.parse({ id: 'g1', title: 'Judul', body_md: 'Isi', lesson_id: null })).toStrictEqual({ id: 'g1', title: 'Judul', bodyMd: 'Isi' });
  });

  test('catatan di dalam unit ikut membawa lessonId', () => {
    const raw = JSON.parse(readFileSync(join(__dirname, '__fixtures__/unit_hiragana.json'), 'utf-8'));
    const unit = unitSchema.parse({ ...raw, grammar_notes: [{ id: 'g_x', title: 'T', body_md: 'B', lesson_id: raw.lessons[0].id }] });
    expect(unit.grammarNotes).toEqual([{ id: 'g_x', title: 'T', bodyMd: 'B', lessonId: raw.lessons[0].id }]);
  });
});
