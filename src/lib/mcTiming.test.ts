import { describe, it, expect } from 'vitest';
import {
  mcTimeline,
  mcGateSeconds,
  derivedMCRoundDuration,
  MC_GATE_SECONDS,
  MC_GATE_WITH_MEDIA_SECONDS,
  MC_FEEDBACK_SECONDS,
  MC_SLACK_SECONDS,
} from './mcTiming';

const T0 = 1_700_000_000_000; // fixed epoch — no Date.now() anywhere in these tests
const at = (seconds: number) => T0 + seconds * 1000;
const oneQuestion = [{ timeLimitSeconds: 20 }];
const twoQuestions = [{ timeLimitSeconds: 20 }, { timeLimitSeconds: 30 }];

const line = (seconds: number, questions = oneQuestion, gateSeconds = 5) =>
  mcTimeline({ roundStartMs: T0, nowMs: at(seconds), gateSeconds, questions });

/** Same, with the "everybody already answered" cutoff written at `cutSeconds`. */
const cutLine = (seconds: number, cutSeconds: number, questions = oneQuestion, gateSeconds = 5) =>
  mcTimeline({ roundStartMs: T0, nowMs: at(seconds), gateSeconds, questions, allAnsweredAtMs: at(cutSeconds) });

describe('mcTimeline with an all-answered cutoff', () => {
  // Gate 0-5s, question 5-25s, feedback 25-30s. Everyone answers at 12s.
  it('closes the question the moment the cutoff lands', () => {
    expect(line(14).phase).toBe('question');       // sin corte seguiria preguntando
    expect(cutLine(14, 12).phase).toBe('feedback');
  });

  it('still plays the full shared reveal after the cutoff', () => {
    // El reveal es compartido y deliberado: cortar el reloj no puede saltarselo.
    expect(cutLine(13, 12).phase).toBe('feedback');
    expect(cutLine(16.5, 12).phase).toBe('feedback');
    expect(cutLine(17.5, 12).phase).toBe('done');
  });

  it('shortens the visible countdown instead of letting it run out', () => {
    // El corte se escribe cuando responde el ultimo, asi que en la practica nunca
    // esta en el futuro; pero si lo estuviera, el reloj tiene que apuntar a el.
    expect(cutLine(8, 12).phase).toBe('question');
    expect(cutLine(8, 12).secondsLeft).toBe(4);
    expect(line(8).secondsLeft).toBe(17);
  });

  it('ignores a cutoff that lands after the question would have ended anyway', () => {
    expect(cutLine(26, 40)).toEqual(line(26));
  });

  it('ignores a cutoff from before the question started', () => {
    expect(cutLine(14, 2)).toEqual(line(14));
  });

  it('is a no-op when no cutoff is given', () => {
    expect(mcTimeline({ roundStartMs: T0, nowMs: at(14), gateSeconds: 5, questions: oneQuestion, allAnsweredAtMs: null }))
      .toEqual(line(14));
  });
});

describe('mcGateSeconds', () => {
  it('gives a media clue room to play', () => {
    expect(mcGateSeconds([{ kind: 'audio', src: 'a.mp3' }])).toBe(MC_GATE_WITH_MEDIA_SECONDS);
  });

  it('keeps the gate short when there is nothing to show', () => {
    expect(mcGateSeconds(undefined)).toBe(MC_GATE_SECONDS);
    expect(mcGateSeconds([])).toBe(MC_GATE_SECONDS);
  });
});

describe('mcTimeline', () => {
  it('holds every screen on the gate until it expires', () => {
    expect(line(0).phase).toBe('gate');
    expect(line(0).secondsLeft).toBe(5);
    expect(line(4.5).phase).toBe('gate');
    expect(line(4.5).secondsLeft).toBe(1);
  });

  it('never reports question 0 as expired at the start of the round', () => {
    // The bug this replaces: a local countdown starting at 0 made question 0 of
    // every block time out in the render before the real limit had loaded.
    for (const s of [0, 0.1, 1, 4.9]) {
      expect(line(s).phase).toBe('gate');
    }
    expect(line(5).phase).toBe('question');
    expect(line(5).secondsLeft).toBe(20);
  });

  it('runs the question for exactly its time limit', () => {
    expect(line(5).phase).toBe('question');
    expect(line(15).secondsLeft).toBe(10);
    expect(line(24.9).phase).toBe('question');
    expect(line(25).phase).toBe('feedback');
  });

  it('shows feedback, then finishes the block', () => {
    expect(line(25).phase).toBe('feedback');
    expect(line(25).secondsLeft).toBe(MC_FEEDBACK_SECONDS);
    expect(line(29.9).phase).toBe('feedback');
    expect(line(30).phase).toBe('done');
  });

  it('reports the same question start for everyone, so speed scoring is fair', () => {
    expect(line(6).questionStartMs).toBe(at(5));
    expect(line(20).questionStartMs).toBe(at(5));
    // ...and during feedback it still points at the question that just ran
    expect(line(26).questionStartMs).toBe(at(5));
  });

  it('walks a multi-question block, honouring per-question limits', () => {
    const l = (s: number) => line(s, twoQuestions);
    expect(l(5)).toMatchObject({ phase: 'question', questionIndex: 0 });
    expect(l(25)).toMatchObject({ phase: 'feedback', questionIndex: 0 });
    expect(l(30)).toMatchObject({ phase: 'question', questionIndex: 1, secondsLeft: 30 });
    expect(l(60)).toMatchObject({ phase: 'feedback', questionIndex: 1 });
    expect(l(65).phase).toBe('done');
  });

  it('falls back to the default limit for a malformed question', () => {
    const l = mcTimeline({
      roundStartMs: T0, nowMs: at(5), gateSeconds: 5,
      questions: [{ timeLimitSeconds: undefined }],
    });
    expect(l).toMatchObject({ phase: 'question', secondsLeft: 20 });
  });

  it('stays on the gate when the round start has not arrived yet', () => {
    // roundStartTime is briefly absent right after the host advances.
    const l = mcTimeline({ roundStartMs: 0, nowMs: at(99), gateSeconds: 5, questions: oneQuestion });
    expect(l).toMatchObject({ phase: 'gate', secondsLeft: 5 });
  });

  it('is done immediately for a block with no questions', () => {
    const l = mcTimeline({ roundStartMs: T0, nowMs: at(6), gateSeconds: 5, questions: [] });
    expect(l.phase).toBe('done');
  });

  it('is a pure function of now — two screens one second apart agree on the phase', () => {
    const a = mcTimeline({ roundStartMs: T0, nowMs: at(12), gateSeconds: 5, questions: twoQuestions });
    const b = mcTimeline({ roundStartMs: T0, nowMs: at(12.4), gateSeconds: 5, questions: twoQuestions });
    expect(a.questionIndex).toBe(b.questionIndex);
    expect(a.phase).toBe(b.phase);
    expect(a.questionStartMs).toBe(b.questionStartMs);
  });
});

describe('derivedMCRoundDuration', () => {
  it('outlasts the whole block so the host never guillotines it', () => {
    const gate = MC_GATE_SECONDS;
    expect(derivedMCRoundDuration(oneQuestion)).toBe(gate + 20 + MC_FEEDBACK_SECONDS + MC_SLACK_SECONDS);
    expect(derivedMCRoundDuration(twoQuestions)).toBe(
      gate + 50 + MC_FEEDBACK_SECONDS * 2 + MC_SLACK_SECONDS,
    );
  });

  it('accounts for the longer gate when the round carries media', () => {
    const media = [{ kind: 'audio', src: 'a.mp3' }];
    expect(derivedMCRoundDuration(oneQuestion, media) - derivedMCRoundDuration(oneQuestion))
      .toBe(MC_GATE_WITH_MEDIA_SECONDS - MC_GATE_SECONDS);
  });

  it('covers the full timeline: the block is over before the round is', () => {
    for (const questions of [oneQuestion, twoQuestions]) {
      const duration = derivedMCRoundDuration(questions);
      const end = mcTimeline({
        roundStartMs: T0, nowMs: at(duration), gateSeconds: MC_GATE_SECONDS, questions,
      });
      expect(end.phase).toBe('done');
    }
  });

  it('handles an empty block without returning a negative duration', () => {
    expect(derivedMCRoundDuration([])).toBe(MC_GATE_SECONDS + MC_SLACK_SECONDS);
    expect(derivedMCRoundDuration(undefined)).toBe(MC_GATE_SECONDS + MC_SLACK_SECONDS);
  });
});
