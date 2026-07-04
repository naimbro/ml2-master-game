import { describe, it, expect } from 'vitest';
import { renderHtml, renderConsole, type GameReport } from './report';

const report: GameReport = {
  gameCode: 'ABCD',
  rounds: [
    {
      round: 1,
      scenarioTitle: 'De tema a decision',
      rows: [
        { playerName: 'Ana', llmScore: 82, llmRank: 1, theta: 0.9, btRank: 1, deltaRank: 0 },
        { playerName: 'Bruno', llmScore: 79, llmRank: 2, theta: -0.4, btRank: 3, deltaRank: -1 },
        { playerName: 'Cata', llmScore: 70, llmRank: 3, theta: 0.1, btRank: 2, deltaRank: 1 },
      ],
      spearman: 0.5,
      kendall: 0.33,
      disagreement: 0.25,
    },
  ],
  overall: {
    rows: [
      { playerName: 'Ana', llmTotal: 82, llmRank: 1, btPoints: 80, btRank: 1, deltaRank: 0 },
      { playerName: 'Bruno', llmTotal: 79, llmRank: 2, btPoints: 60, btRank: 3, deltaRank: -1 },
      { playerName: 'Cata', llmTotal: 70, llmRank: 3, btPoints: 70, btRank: 2, deltaRank: 1 },
    ],
    spearman: 0.5,
    kendall: 0.33,
  },
};

describe('renderHtml', () => {
  it('produces a self-contained document with player names and the verdict', () => {
    const html = renderHtml(report);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('ABCD');
    expect(html).toContain('Ana');
    expect(html).toContain('De tema a decision');
    expect(html).toContain('0.50'); // overall spearman, formatted
    expect(html).not.toContain('undefined');
  });
});

describe('renderConsole', () => {
  it('includes the overall verdict line', () => {
    const out = renderConsole(report);
    expect(out).toContain('rho');
    expect(out).toContain('0.50');
    expect(out).toContain('Ana');
  });
});
