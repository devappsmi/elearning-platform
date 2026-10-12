import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { scenarioContentSchema } from './types';

describe('scenarioContentSchema terhadap __fixtures__/scenario_perkenalan.json', () => {
  const raw = JSON.parse(readFileSync(join(__dirname, '__fixtures__/scenario_perkenalan.json'), 'utf-8'));

  test('parse tanpa error, field snake_case dipetakan ke camelCase', () => {
    const scenario = scenarioContentSchema.parse(raw);
    expect(scenario.scenarioId).toBe('perkenalan');
    expect(scenario.titleJp).toBe('自己紹介');
    expect(scenario.titleId).toBe('Perkenalan Diri');
    expect(scenario.estimatedMinutes).toBe(3);
    expect(scenario.lines).toHaveLength(5);
    expect(scenario.vocab).toEqual(['voc_hajimemashite', 'voc_onamae', 'voc_yoroshiku']);
    expect(scenario.grammarNotes).toHaveLength(1);
    expect(scenario.grammarNotes[0]).toHaveProperty('bodyMd');
  });

  test('membedakan baris narasi dan baris choice dengan benar', () => {
    const scenario = scenarioContentSchema.parse(raw);
    expect(scenario.lines[0]?.kind).toBe('narration');
    expect(scenario.lines[1]?.kind).toBe('choice');
    expect(scenario.lines[2]?.kind).toBe('narration');
    expect(scenario.lines[3]?.kind).toBe('choice');
    expect(scenario.lines[4]?.kind).toBe('narration');
  });

  test('baris narasi: field id -> meaning', () => {
    const scenario = scenarioContentSchema.parse(raw);
    const line = scenario.lines[0];
    if (line?.kind !== 'narration') throw new Error('expected narration');
    expect(line.meaning).toBe('Halo! Perkenalkan.');
    expect(line).not.toHaveProperty('id');
  });

  test('baris choice: opsi salah punya feedbackId, opsi benar tidak', () => {
    const scenario = scenarioContentSchema.parse(raw);
    const line = scenario.lines[1];
    if (line?.kind !== 'choice') throw new Error('expected choice');
    expect(line.options[0]).toEqual({
      jp: 'はじめまして。よろしくお願いします。',
      furigana: [{ text: 'はじめまして。よろしくお' }, { text: '願', reading: 'ねが' }, { text: 'いします。' }],
      correct: true,
      feedbackId: undefined,
      audio: '',
    });
    expect(line.options[1]?.correct).toBe(false);
    expect(line.options[1]?.feedbackId).toContain('さようなら');
  });

  test('furigana: kalimat berkanji dipecah per kanji berbacaan, kalimat tanpa kanji tidak diberi furigana', () => {
    const scenario = scenarioContentSchema.parse(raw);
    const first = scenario.lines[0];
    const question = scenario.lines[2];
    if (first?.kind !== 'narration' || question?.kind !== 'narration') throw new Error('expected narration');
    expect(first.furigana).toBeUndefined();
    expect(question.furigana).toEqual([
      { text: 'お' },
      { text: '名前', reading: 'なまえ' },
      { text: 'は' },
      { text: '何', reading: 'なん' },
      { text: 'ですか。' },
    ]);
  });
});

describe('scenarioContentSchema: furigana yang tidak cocok ditolak', () => {
  const raw = JSON.parse(readFileSync(join(__dirname, '__fixtures__/scenario_perkenalan.json'), 'utf-8'));

  test('baris narasi yang furigananya mengubah kalimat', () => {
    const broken = structuredClone(raw);
    broken.lines[2].furigana = 'お{名前|なまえ}はなんですか。';
    const result = scenarioContentSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('teks Jepangnya');
  });

  test('opsi jawaban dengan bacaan romaji', () => {
    const broken = structuredClone(raw);
    broken.lines[3].options[0].furigana = 'わたしの{名前|namae}はアニです。';
    expect(scenarioContentSchema.safeParse(broken).success).toBe(false);
  });
});
