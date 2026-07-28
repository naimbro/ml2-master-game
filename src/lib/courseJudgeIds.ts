// Resolving which judges belong to a course.
//
// A course's roster is NOT "the judges tagged with this courseId" — most courses reuse the
// judgeIds seeded for ml2-2025 / ai_democracy_2026 instead of defining their own, and courses
// created from the frontend get a Firestore autoid that no judge is ever tagged with. What every
// course DOES have is sessions, and every session declares `config.judges: [{judgeId, weight}]`.
// That is what the backend resolves against at evaluation time (functions/src/index.ts), so the
// UI resolves the same way: tagged judges first, then whatever the sessions actually use.
//
// No firebase imports here — keeps this unit-testable.
import type { BaselineJudge } from './judges';

/** What the AI session builder writes into every new session (functions/src/lib/sessionDraft.ts). */
/**
 * El panel que hereda un curso que todavía no define el suyo.
 *
 * Son genéricos y sin nombre propio a propósito: apuntaba a los jueces de
 * ml2-2025, así que cualquier profesor que creaba un curso empezaba con el panel
 * de Naim, incluido un juez llamado literalmente "Profe Naim". Las personas viven
 * en content/courses/_generic/judges.json y cada profesor las puede reescribir
 * desde la pantalla de Jueces del curso.
 */
export const DEFAULT_JUDGE_IDS = ['generic_specialist', 'generic_praxis', 'generic_teacher'] as const;

interface SessionLike {
  config?: { judges?: { judgeId?: string }[] };
}

/** Union of the judgeIds a course's sessions reference, deduped, in first-appearance order. */
export function judgeIdsFromSessions(sessions: SessionLike[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const session of sessions) {
    const judges = session?.config?.judges;
    if (!Array.isArray(judges)) continue;
    for (const jw of judges) {
      const id = typeof jw?.judgeId === 'string' ? jw.judgeId.trim() : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Build the roster shown in the UI: judges tagged with this course, then the ones its sessions
 * reference. A judgeId with no entry in config/judges is dropped — the backend already warns
 * about that case when it happens during evaluation.
 */
export function mergeJudgeRoster(
  courseId: string,
  derivedJudgeIds: string[],
  allJudges: BaselineJudge[],
): BaselineJudge[] {
  const roster = allJudges.filter((j) => j.courseId === courseId);
  const seen = new Set(roster.map((j) => j.judgeId));
  for (const id of derivedJudgeIds) {
    if (seen.has(id)) continue;
    const judge = allJudges.find((j) => j.judgeId === id);
    if (!judge) continue;
    seen.add(id);
    roster.push(judge);
  }
  return roster;
}
