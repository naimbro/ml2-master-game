import { describe, it, expect } from 'vitest';
import { coerceScore } from './parse';

describe('coerceScore', () => {
  it('passes numbers through', () => {
    expect(coerceScore(60)).toBe(60);
    expect(coerceScore(0)).toBe(0);
  });
  it('parses numeric strings (some games store judge scores as strings)', () => {
    expect(coerceScore('60')).toBe(60);
    expect(coerceScore(' 42 ')).toBe(42);
  });
  it('is NaN for genuinely missing or non-numeric values', () => {
    expect(Number.isNaN(coerceScore(null))).toBe(true);
    expect(Number.isNaN(coerceScore(undefined))).toBe(true);
    expect(Number.isNaN(coerceScore(''))).toBe(true);
    expect(Number.isNaN(coerceScore('abc'))).toBe(true);
    expect(Number.isNaN(coerceScore('12abc'))).toBe(true);
  });
});
