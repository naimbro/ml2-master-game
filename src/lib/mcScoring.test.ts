import { describe, it, expect } from 'vitest';
import {
  speedFactor,
  scoreMCQuestion,
  scoreMCBlock,
  MC_CORRECT_BASE,
  MC_WRONG_POINTS,
  MC_NO_ANSWER_POINTS,
} from './mcScoring';
import type { MCResponse } from '../types/game';

function response(pointsAwarded: number, questionIndex = 0): MCResponse {
  return {
    questionIndex,
    selectedOptionId: 'A',
    responseTimeMs: 0,
    correct: pointsAwarded >= MC_CORRECT_BASE,
    pointsAwarded,
  };
}

describe('speedFactor', () => {
  it('is 1 for an instant answer and 0 at the buzzer', () => {
    expect(speedFactor(0, 20)).toBe(1);
    expect(speedFactor(20_000, 20)).toBe(0);
  });

  it('is linear in between', () => {
    expect(speedFactor(10_000, 20)).toBeCloseTo(0.5);
    expect(speedFactor(5_000, 20)).toBeCloseTo(0.75);
  });

  it('clamps rather than going negative when the answer lands after the limit', () => {
    expect(speedFactor(30_000, 20)).toBe(0);
    expect(speedFactor(999_999, 1)).toBe(0);
  });

  it('survives malformed input instead of producing NaN', () => {
    expect(speedFactor(NaN, 20)).toBe(0);
    expect(speedFactor(1000, 0)).toBe(0);
    expect(speedFactor(1000, -5)).toBe(0);
    expect(speedFactor(-1000, 20)).toBe(1); // negative elapsed treated as instant
  });
});

describe('scoreMCQuestion', () => {
  it('gives 100 for an instant correct answer', () => {
    expect(scoreMCQuestion({ correct: true, answered: true, elapsedMs: 0, timeLimitSeconds: 20 })).toBe(100);
  });

  it('gives exactly 70 for a correct answer at the buzzer', () => {
    expect(scoreMCQuestion({ correct: true, answered: true, elapsedMs: 20_000, timeLimitSeconds: 20 })).toBe(70);
  });

  it('clamps to 70 — never below — when elapsed exceeds the limit', () => {
    expect(scoreMCQuestion({ correct: true, answered: true, elapsedMs: 45_000, timeLimitSeconds: 20 })).toBe(70);
  });

  it('scales the speed bonus linearly', () => {
    expect(scoreMCQuestion({ correct: true, answered: true, elapsedMs: 10_000, timeLimitSeconds: 20 })).toBe(85);
    expect(scoreMCQuestion({ correct: true, answered: true, elapsedMs: 5_000, timeLimitSeconds: 20 })).toBe(93);
  });

  it('gives 20 for an answered-but-wrong question, regardless of speed', () => {
    expect(scoreMCQuestion({ correct: false, answered: true, elapsedMs: 0, timeLimitSeconds: 20 })).toBe(MC_WRONG_POINTS);
    expect(scoreMCQuestion({ correct: false, answered: true, elapsedMs: 19_000, timeLimitSeconds: 20 })).toBe(MC_WRONG_POINTS);
  });

  it('gives 0 for a timeout, even if flagged correct by a caller bug', () => {
    expect(scoreMCQuestion({ correct: false, answered: false, elapsedMs: 20_000, timeLimitSeconds: 20 })).toBe(MC_NO_ANSWER_POINTS);
    expect(scoreMCQuestion({ correct: true, answered: false, elapsedMs: 20_000, timeLimitSeconds: 20 })).toBe(MC_NO_ANSWER_POINTS);
  });

  it('always returns an integer in [0, 100]', () => {
    for (const elapsedMs of [0, 1, 333, 7_777, 19_999, 20_000, 60_000]) {
      for (const correct of [true, false]) {
        for (const answered of [true, false]) {
          const score = scoreMCQuestion({ correct, answered, elapsedMs, timeLimitSeconds: 20 });
          expect(Number.isInteger(score)).toBe(true);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('keeps a slow correct answer above a fast wrong one', () => {
    const slowCorrect = scoreMCQuestion({ correct: true, answered: true, elapsedMs: 20_000, timeLimitSeconds: 20 });
    const fastWrong = scoreMCQuestion({ correct: false, answered: true, elapsedMs: 0, timeLimitSeconds: 20 });
    expect(slowCorrect).toBeGreaterThan(fastWrong);
  });
});

describe('scoreMCBlock', () => {
  it('divides by TOTAL questions, not answered ones', () => {
    // One lucky instant answer then abandonment: 100/3, not 100.
    expect(scoreMCBlock([response(100)], 3)).toBe(33);
  });

  it('does not reward quitting early over completing the block', () => {
    const quitAfterOne = scoreMCBlock([response(100)], 3);
    const completedAllThree = scoreMCBlock([response(100), response(20, 1), response(20, 2)], 3);
    expect(completedAllThree).toBeGreaterThan(quitAfterOne);
  });

  it('averages a fully answered block', () => {
    expect(scoreMCBlock([response(100), response(70, 1)], 2)).toBe(85);
    expect(scoreMCBlock([response(100), response(0, 1), response(0, 2)], 3)).toBe(33);
  });

  it('gives 100 when every question is answered correctly and instantly', () => {
    expect(scoreMCBlock([response(100), response(100, 1), response(100, 2)], 3)).toBe(100);
  });

  it('returns 0 for an empty block without producing NaN', () => {
    expect(scoreMCBlock([], 3)).toBe(0);
    expect(scoreMCBlock([], 0)).toBe(0);
  });

  it('returns 0 rather than dividing by zero or a bad total', () => {
    expect(scoreMCBlock([response(100)], 0)).toBe(0);
    expect(scoreMCBlock([response(100)], -1)).toBe(0);
    expect(scoreMCBlock([response(100)], NaN)).toBe(0);
  });

  it('ignores malformed pointsAwarded instead of poisoning the mean', () => {
    const dirty = [response(100), { ...response(0, 1), pointsAwarded: undefined as unknown as number }];
    expect(scoreMCBlock(dirty, 2)).toBe(50);
  });

  it('always returns an integer in [0, 100]', () => {
    const cases: Array<[MCResponse[], number]> = [
      [[response(100)], 1],
      [[response(20), response(20, 1)], 2],
      [[response(0)], 5],
      [[response(100), response(100, 1), response(100, 2), response(100, 3)], 4],
    ];
    for (const [responses, total] of cases) {
      const score = scoreMCBlock(responses, total);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
