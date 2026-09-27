import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { findVocabById, unitSchema } from './types';

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
