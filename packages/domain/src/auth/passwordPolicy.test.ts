import { describe, expect, test } from 'vitest';
import { PASSWORD_LETTER_AND_DIGIT, PASSWORD_MIN_LENGTH, passwordPolicyViolation } from './passwordPolicy';

describe('passwordPolicyViolation (AUTH-02: min. 8 karakter, huruf + angka)', () => {
  test.each(['abcdefg1', 'Password1', 'kata sandi 2', '12345678a', 'A1bcdefghijklmnop'])('%j memenuhi kebijakan', (password) => {
    expect(passwordPolicyViolation(password)).toBeNull();
  });

  test.each(['', 'a', 'abc123', 'abcde12'])('%j terlalu pendek (<8)', (password) => {
    expect(passwordPolicyViolation(password)).toBe('TOO_SHORT');
  });

  test.each(['abcdefgh', 'ABCDEFGH', 'kata sandi'])('%j tanpa angka ditolak', (password) => {
    expect(passwordPolicyViolation(password)).toBe('MISSING_LETTER_OR_DIGIT');
  });

  test.each(['12345678', '00000000'])('%j tanpa huruf ditolak', (password) => {
    expect(passwordPolicyViolation(password)).toBe('MISSING_LETTER_OR_DIGIT');
  });

  test('tepat 8 karakter lolos, 7 karakter tidak', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(passwordPolicyViolation('abcdef1x')).toBeNull();
    expect(passwordPolicyViolation('abcde1x')).toBe('TOO_SHORT');
  });

  test('"huruf" berarti A-Z/a-z: kana/kanji + angka saja TIDAK cukup (sama dengan aturan server)', () => {
    expect(passwordPolicyViolation('パスワード12345')).toBe('MISSING_LETTER_OR_DIGIT');
    expect(passwordPolicyViolation('パスワード12345a')).toBeNull();
  });

  test('panjang dihitung per kode poin, bukan unit UTF-16 (emoji = 1 karakter)', () => {
    // 4 emoji + "a1" = 6 karakter (10 unit UTF-16) -> harus dianggap terlalu pendek.
    expect(passwordPolicyViolation('😀😀😀😀a1')).toBe('TOO_SHORT');
    // 6 emoji + "a1" = 8 karakter -> lolos.
    expect(passwordPolicyViolation('😀😀😀😀😀😀a1')).toBeNull();
  });

  test('spasi di tepi/dalam tidak dipangkas dan dihitung sebagai karakter', () => {
    expect(passwordPolicyViolation('  abc1  ')).toBeNull(); // 8 karakter termasuk 4 spasi
  });
});

describe('PASSWORD_LETTER_AND_DIGIT', () => {
  test('regex yang sama dipakai server (@Matches) dan klien', () => {
    expect(PASSWORD_LETTER_AND_DIGIT.test('abc123')).toBe(true);
    expect(PASSWORD_LETTER_AND_DIGIT.test('abcdef')).toBe(false);
    expect(PASSWORD_LETTER_AND_DIGIT.test('123456')).toBe(false);
  });
});
