import { describe, it, expect } from 'vitest';
import { judgeIdsFromSessions, mergeJudgeRoster, DEFAULT_JUDGE_IDS } from './courseJudgeIds';
import type { BaselineJudge } from './judges';

const judge = (judgeId: string, courseId?: string): BaselineJudge => ({
  judgeId,
  courseId,
  name: judgeId,
  avatar: '🤖',
  personality: '',
  evaluationStyle: '',
});

describe('judgeIdsFromSessions', () => {
  it('collects judgeIds across sessions, deduped, in first-appearance order', () => {
    const ids = judgeIdsFromSessions([
      { config: { judges: [{ judgeId: 'b' }, { judgeId: 'a' }] } },
      { config: { judges: [{ judgeId: 'a' }, { judgeId: 'c' }] } },
    ]);
    expect(ids).toEqual(['b', 'a', 'c']);
  });

  it('ignores sessions with no config, no judges, or malformed entries', () => {
    const ids = judgeIdsFromSessions([
      {},
      { config: {} },
      { config: { judges: [] } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { config: { judges: 'nope' as any } },
      { config: { judges: [{ weight: 1 }, { judgeId: '' }, { judgeId: '  ' }, { judgeId: 'ok' }] } },
    ]);
    expect(ids).toEqual(['ok']);
  });

  it('returns an empty list for a course with no sessions', () => {
    expect(judgeIdsFromSessions([])).toEqual([]);
  });
});

describe('mergeJudgeRoster', () => {
  const all = [
    judge('technical_expert', 'ml2-2025'),
    judge('public_sector', 'ml2-2025'),
    judge('professor_twin', 'ml2-2025'),
    judge('democracy_scholar', 'ai_democracy_2026'),
  ];

  it('keeps tagged judges first, then the ones derived from sessions', () => {
    const roster = mergeJudgeRoster('ml2-2025', ['democracy_scholar', 'technical_expert'], all);
    expect(roster.map((j) => j.judgeId)).toEqual([
      'technical_expert', 'public_sector', 'professor_twin', 'democracy_scholar',
    ]);
  });

  it('resolves a course with no judges of its own from its sessions (mundial_2026)', () => {
    const roster = mergeJudgeRoster(
      'mundial_2026',
      ['technical_expert', 'public_sector', 'professor_twin'],
      all,
    );
    expect(roster.map((j) => j.judgeId)).toEqual([
      'technical_expert', 'public_sector', 'professor_twin',
    ]);
  });

  it('ignores judgeIds that are not present in config/judges', () => {
    const roster = mergeJudgeRoster('x', ['ghost', 'public_sector'], all);
    expect(roster.map((j) => j.judgeId)).toEqual(['public_sector']);
  });

  it('never repeats a judge that is both tagged and referenced by a session', () => {
    const roster = mergeJudgeRoster('ml2-2025', ['technical_expert'], all);
    expect(roster.filter((j) => j.judgeId === 'technical_expert')).toHaveLength(1);
  });

  it('returns nothing when the course has neither tagged nor derived judges', () => {
    expect(mergeJudgeRoster('empty', [], all)).toEqual([]);
  });
});

describe('DEFAULT_JUDGE_IDS', () => {
  it('matches the trio the AI session builder writes into every new session', () => {
    expect([...DEFAULT_JUDGE_IDS]).toEqual(['technical_expert', 'public_sector', 'professor_twin']);
  });
});
