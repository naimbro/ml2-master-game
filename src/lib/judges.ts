import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getCourse, getSessionsForCourse } from './courses';
import { fetchSessions } from './dynamicCourses';
import { DEFAULT_JUDGE_IDS, judgeIdsFromSessions, mergeJudgeRoster } from './courseJudgeIds';

// Mirror of the backend whitelist (functions/src/lib/judgeOverrides.ts). Keep in sync.
export const JUDGE_OVERRIDE_FIELDS = ['name', 'avatar', 'personality', 'evaluationStyle'] as const;
export type JudgeOverrideField = (typeof JUDGE_OVERRIDE_FIELDS)[number];
export type JudgeOverride = Partial<Record<JudgeOverrideField, string>>;
export type JudgeOverrides = Record<string, JudgeOverride>;

/** The seeded persona for one judge, as stored in config/judges. */
export interface BaselineJudge {
  judgeId: string;
  courseId?: string;
  name: string;
  avatar: string;
  personality: string;
  evaluationStyle: string;
}

/** Keep only whitelisted, non-empty, trimmed string fields. */
export function pickOverrideFields(input: Record<string, unknown>): JudgeOverride {
  const out: JudgeOverride = {};
  for (const field of JUDGE_OVERRIDE_FIELDS) {
    const value = input[field];
    if (typeof value === 'string' && value.trim() !== '') {
      out[field] = value.trim();
    }
  }
  return out;
}

/**
 * The judgeIds a course's sessions reference — read from the hardcoded catalog for repo courses
 * and from `courses/<id>/sessions` for professor-authored ones. A course with no sessions yet
 * falls back to the trio the AI builder will put in its first session.
 */
async function judgeIdsForCourse(courseId: string): Promise<string[]> {
  const sessions = getCourse(courseId)
    ? getSessionsForCourse(courseId)
    : await fetchSessions(courseId).catch((err) => {
        console.warn(`No se pudieron leer las sesiones de ${courseId}:`, err);
        return [];
      });
  const ids = judgeIdsFromSessions(sessions);
  return ids.length > 0 ? ids : [...DEFAULT_JUDGE_IDS];
}

/**
 * Seeded personas for one course, read from the global config/judges doc: the judges tagged with
 * this courseId, plus the ones its sessions actually use. See ./courseJudgeIds for why the tag
 * alone is not enough.
 */
export async function fetchCourseJudges(courseId: string): Promise<BaselineJudge[]> {
  const [snap, derivedIds] = await Promise.all([
    getDoc(doc(db, 'config', 'judges')),
    judgeIdsForCourse(courseId),
  ]);
  if (!snap.exists()) return [];
  const judges = (snap.data().judges || []) as BaselineJudge[];
  return mergeJudgeRoster(courseId, derivedIds, judges);
}

/** Current per-course overrides (without the updatedAt/updatedBy metadata). */
export async function fetchJudgeOverrides(courseId: string): Promise<JudgeOverrides> {
  const snap = await getDoc(doc(db, 'judgeOverrides', courseId));
  if (!snap.exists()) return {};
  const data = snap.data() as Record<string, unknown>;
  const out: JudgeOverrides = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'updatedAt' || key === 'updatedBy') continue;
    if (value && typeof value === 'object') out[key] = pickOverrideFields(value as Record<string, unknown>);
  }
  return out;
}

/**
 * Persist edits for a course. `edits` is keyed by judgeId; each value is stripped to the
 * whitelist and empty overrides are dropped so a judge with no changes isn't stored.
 */
export async function saveJudgeOverrides(
  courseId: string,
  uid: string,
  edits: Record<string, Record<string, unknown>>,
): Promise<void> {
  const clean: JudgeOverrides = {};
  for (const [judgeId, fields] of Object.entries(edits)) {
    const picked = pickOverrideFields(fields);
    if (Object.keys(picked).length > 0) clean[judgeId] = picked;
  }
  await setDoc(doc(db, 'judgeOverrides', courseId), {
    ...clean,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}
