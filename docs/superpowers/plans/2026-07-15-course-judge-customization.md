# Course-level Judge Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let professors rename and re-persona a course's AI judges (name, avatar, personality, evaluation style) from a dedicated frontend page, with edits that persist course-wide and take effect at evaluation time without a re-seed or a full re-deploy.

**Architecture:** A new Firestore collection `judgeOverrides/{courseId}` stores per-course persona overrides. The Cloud Functions read that doc at eval time and merge it over the seeded `config/judges` baseline via a pure, whitelisted `applyJudgeOverrides` helper (the whitelist is the safety boundary — `provider`/`model`/`promptTemplate` can never be overridden). A dedicated `CourseJudges` page reads the baseline (`config/judges`, newly tagged with `courseId`) plus the overrides and writes edits back live.

**Tech Stack:** TypeScript, React + Vite (frontend), Firebase Cloud Functions + Firestore (backend), vitest (tests), plain Node `.cjs` seed script.

---

## File Structure

**Backend (Cloud Functions):**
- Create: `functions/src/lib/judgeOverrides.ts` — pure merge helper + override types. One responsibility: layering overrides over baseline judges.
- Create: `functions/src/lib/judgeOverrides.test.ts` — unit tests for the helper.
- Modify: `functions/src/index.ts` — add `loadJudgeOverrides` reader + wire the merge into both eval call sites (`evaluateSubmission`, `processRoundEnd`).

**Seed:**
- Modify: `scripts/seed-firestore.cjs` — tag each seeded judge with its `courseId`; make the loader importable so it can be verified without hitting Firestore.

**Rules:**
- Modify: `firestore.rules` — allow authenticated read of `config/*` and read/write of `judgeOverrides/*`.

**Frontend:**
- Modify: `src/types/content.ts` — add optional `courseId` to the `Judge` interface.
- Create: `src/lib/judges.ts` — Firestore I/O for baseline judges + overrides, plus the pure `pickOverrideFields` whitelist helper.
- Create: `src/lib/judges.test.ts` — unit tests for `pickOverrideFields`.
- Create: `src/pages/professor/CourseJudges.tsx` — the editor page.
- Modify: `src/App.tsx` — route `/professor/courses/:courseId/judges`.
- Modify: `src/pages/professor/CourseHome.tsx` — entry link for dynamic courses.
- Modify: `src/pages/professor/Dashboard.tsx` — entry link for built-in courses.

---

## Task 1: Tag seeded judges with `courseId`

**Files:**
- Modify: `scripts/seed-firestore.cjs`

The frontend and backend both need to know which judges belong to a course. `config/judges` is a flat union today with no `courseId`. The seed loop already iterates per course, so it has the value — attach it. Also guard the auto-run and export the loader so we can verify offline (no Firestore write).

- [ ] **Step 1: Attach `courseId` when collecting judges**

In `scripts/seed-firestore.cjs`, inside `loadCourseJudges`, change the push line:

```js
      seenIds.add(judge.judgeId);
      allJudges.push({ ...judge, courseId });
```

(Replaces the existing `allJudges.push(judge);`.)

- [ ] **Step 2: Make the loader importable without side effects**

At the bottom of `scripts/seed-firestore.cjs`, replace the unconditional `main();` call with:

```js
if (require.main === module) {
  main();
} else {
  module.exports = { loadCourseJudges };
}
```

- [ ] **Step 3: Verify offline that every judge now carries a courseId**

Run from the project root:

```bash
node -e "const {loadCourseJudges}=require('./scripts/seed-firestore.cjs'); const j=loadCourseJudges().judges; const bad=j.filter(x=>!x.courseId); console.log('judges:',j.length,'| missing courseId:',bad.length); console.log(j.map(x=>x.judgeId+':'+x.courseId).join('\n')); process.exit(bad.length?1:0)"
```

Expected: exit 0, `missing courseId: 0`, and each line like `technical_expert:ml2-2025`, `democracy_scholar:ai_democracy_2026`. (`admin.initializeApp` runs on require but makes no network call; `loadCourseJudges` only reads local JSON.)

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-firestore.cjs
git commit -m "feat(seed): tag config/judges records with courseId"
```

---

## Task 2: Backend merge helper `applyJudgeOverrides`

**Files:**
- Create: `functions/src/lib/judgeOverrides.ts`
- Test: `functions/src/lib/judgeOverrides.test.ts`

TDD. This pure helper is the safety boundary: it only ever copies whitelisted, non-empty string fields onto a judge.

- [ ] **Step 1: Write the failing test**

Create `functions/src/lib/judgeOverrides.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyJudgeOverrides, JUDGE_OVERRIDE_FIELDS } from './judgeOverrides';

const baseline = [
  {
    judgeId: 'technical_expert',
    name: 'Dr. Tech',
    avatar: '🔬',
    personality: 'baseline personality',
    evaluationStyle: 'baseline style',
    provider: 'openai',
    model: 'gpt-5',
    promptTemplate: 'BASELINE TEMPLATE',
  },
];

describe('applyJudgeOverrides', () => {
  it('returns judges untouched when overrides is null/undefined', () => {
    expect(applyJudgeOverrides(baseline, null)).toEqual(baseline);
    expect(applyJudgeOverrides(baseline, undefined)).toEqual(baseline);
  });

  it('returns judges untouched when there is no override for the judgeId', () => {
    expect(applyJudgeOverrides(baseline, { someone_else: { name: 'X' } })).toEqual(baseline);
  });

  it('applies a partial override (name only), leaving other fields at baseline', () => {
    const out = applyJudgeOverrides(baseline, { technical_expert: { name: 'Dra. Redes' } });
    expect(out[0].name).toBe('Dra. Redes');
    expect(out[0].avatar).toBe('🔬');
    expect(out[0].personality).toBe('baseline personality');
  });

  it('applies a full persona override', () => {
    const out = applyJudgeOverrides(baseline, {
      technical_expert: { name: 'N', avatar: '🧠', personality: 'P', evaluationStyle: 'E' },
    });
    expect(out[0]).toMatchObject({ name: 'N', avatar: '🧠', personality: 'P', evaluationStyle: 'E' });
  });

  it('IGNORES non-whitelisted fields (provider/model/promptTemplate)', () => {
    const out = applyJudgeOverrides(baseline, {
      technical_expert: { provider: 'gemini', model: 'gemini-2.5-flash', promptTemplate: 'HACK' } as never,
    });
    expect(out[0].provider).toBe('openai');
    expect(out[0].model).toBe('gpt-5');
    expect(out[0].promptTemplate).toBe('BASELINE TEMPLATE');
  });

  it('ignores empty / whitespace-only values (falls through to baseline)', () => {
    const out = applyJudgeOverrides(baseline, { technical_expert: { name: '   ', avatar: '' } });
    expect(out[0].name).toBe('Dr. Tech');
    expect(out[0].avatar).toBe('🔬');
  });

  it('ignores metadata keys like updatedAt/updatedBy without crashing', () => {
    const overrides = { updatedAt: 123, updatedBy: 'uid', technical_expert: { name: 'N' } } as never;
    const out = applyJudgeOverrides(baseline, overrides);
    expect(out[0].name).toBe('N');
  });

  it('exposes the whitelist and it is exactly the four persona fields', () => {
    expect([...JUDGE_OVERRIDE_FIELDS]).toEqual(['name', 'avatar', 'personality', 'evaluationStyle']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd functions && npx vitest run src/lib/judgeOverrides.test.ts`
Expected: FAIL — cannot find module `./judgeOverrides`.

- [ ] **Step 3: Write the minimal implementation**

Create `functions/src/lib/judgeOverrides.ts`:

```ts
// Per-course judge persona overrides, layered over the seeded config/judges baseline.
//
// The whitelist below is the safety boundary: only these four persona fields can be
// overridden from the frontend. provider/model/promptTemplate are never copied, so a
// hand-edited or hostile override doc can neither change which model runs nor alter the
// prompt template the scoring JSON contract depends on.
export const JUDGE_OVERRIDE_FIELDS = ['name', 'avatar', 'personality', 'evaluationStyle'] as const;
export type JudgeOverrideField = (typeof JUDGE_OVERRIDE_FIELDS)[number];

export type JudgeOverride = Partial<Record<JudgeOverrideField, string>>;
/** Keyed by judgeId. May also contain metadata keys (updatedAt/updatedBy) — ignored. */
export type JudgeOverrides = Record<string, unknown>;

export function applyJudgeOverrides<T extends { judgeId: string }>(
  judges: T[],
  overrides: JudgeOverrides | null | undefined,
): T[] {
  if (!overrides) return judges;
  return judges.map((judge) => {
    const ov = overrides[judge.judgeId];
    if (!ov || typeof ov !== 'object') return judge;
    const source = ov as Record<string, unknown>;
    const picked: Partial<Record<JudgeOverrideField, string>> = {};
    for (const field of JUDGE_OVERRIDE_FIELDS) {
      const value = source[field];
      if (typeof value === 'string' && value.trim() !== '') {
        picked[field] = value;
      }
    }
    return { ...judge, ...picked };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd functions && npx vitest run src/lib/judgeOverrides.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/lib/judgeOverrides.ts functions/src/lib/judgeOverrides.test.ts
git commit -m "feat(judges): whitelisted applyJudgeOverrides merge helper"
```

---

## Task 3: Wire the merge into both eval call sites

**Files:**
- Modify: `functions/src/index.ts` (import + `loadJudgeOverrides` helper + two call sites at ~`:565` and ~`:674`)

- [ ] **Step 1: Add the import**

Near the other `./lib/*` imports at the top of `functions/src/index.ts`, add:

```ts
import { applyJudgeOverrides, type JudgeOverrides } from './lib/judgeOverrides';
```

- [ ] **Step 2: Add a reader helper**

Add this near the other top-level helper functions (e.g. just above `buildJudgeClients`, around `functions/src/index.ts:187`):

```ts
/**
 * Per-course judge persona overrides (name/avatar/personality/evaluationStyle),
 * written live from the frontend and layered over the seeded config/judges baseline.
 * Returns null when the course has no overrides (or the game predates courseId).
 */
async function loadJudgeOverrides(courseId: string | undefined): Promise<JudgeOverrides | null> {
  if (!courseId) return null;
  const snap = await db.collection('judgeOverrides').doc(courseId).get();
  return snap.exists ? (snap.data() as JudgeOverrides) : null;
}
```

- [ ] **Step 3: Merge in `evaluateSubmission`**

In `evaluateSubmission`, find the block that ends with `const clients = await buildJudgeClients(activeJudges);` (around `functions/src/index.ts:571`). Replace that single line with:

```ts
      const judgeOverrides = await loadJudgeOverrides(game.courseId);
      const mergedJudges = applyJudgeOverrides(activeJudges, judgeOverrides);
      const clients = await buildJudgeClients(mergedJudges);
```

Then update the `evaluationPromises` map immediately below it to iterate `mergedJudges` instead of `activeJudges`:

```ts
      const evaluationPromises = mergedJudges.map((judge) =>
        evaluateWithJudge(
          clients, judge, scenario, submission.response,
          sessionConfig, game.knowledgeBase || '', game.referenceDocs || '',
          isRanked
        )
      );
```

- [ ] **Step 4: Merge in `processRoundEnd`**

In `processRoundEnd`, find the block that ends with `const clients = await buildJudgeClients(activeJudges);` (around `functions/src/index.ts:677`). Replace that single line with:

```ts
      const judgeOverrides = await loadJudgeOverrides(game.courseId);
      const mergedJudges = applyJudgeOverrides(activeJudges, judgeOverrides);
      const clients = await buildJudgeClients(mergedJudges);
```

Then update the inner `evaluationPromises` map (inside the `for (const doc of unevaluatedDocs)` loop, around `functions/src/index.ts:682`) to iterate `mergedJudges`:

```ts
        const evaluationPromises = mergedJudges.map((judge) =>
          evaluateWithJudge(
            clients, judge, scenario, submission.response,
```

(Leave the rest of the `evaluateWithJudge(...)` argument list unchanged.)

- [ ] **Step 5: Build the functions to verify types**

Run: `cd functions && npm run build`
Expected: tsc completes with no errors (compiled output in `functions/lib/`).

- [ ] **Step 6: Run the full functions test suite**

Run: `cd functions && npm test`
Expected: PASS — all existing suites plus `judgeOverrides.test.ts` green.

- [ ] **Step 7: Commit**

```bash
git add functions/src/index.ts \
        functions/lib/index.js functions/lib/index.js.map \
        functions/lib/lib/judgeOverrides.js functions/lib/lib/judgeOverrides.js.map
git commit -m "feat(judges): merge per-course overrides at eval time in both call sites"
```

(The compiled `functions/lib/lib/judgeOverrides.js` is produced by the `npm run build` in Step 5 — the repo commits compiled output.)

---

## Task 4: Firestore rules for baseline read + overrides read/write

**Files:**
- Modify: `firestore.rules`

The frontend cannot read `config/judges` today (no rule → default deny), and `judgeOverrides` does not exist yet. Add both. Writes to overrides are gated to approved professors (reusing the existing `isApprovedProfessor()` helper); the code-side whitelist in Task 2 gates *what* can be written.

- [ ] **Step 1: Add the rules**

In `firestore.rules`, inside the top-level `match /databases/{database}/documents { ... }` block, next to the existing `match /judges/{judgeId}` block near the end, add:

```
    // Seeded judge baseline (personas) — readable by any authenticated professor so the
    // course-judges editor can show current personas. Written only by the seed (admin SDK).
    match /config/{docId} {
      allow read: if isAuthenticated();
      allow write: if false;
    }

    // Per-course judge persona overrides (name/avatar/personality/evaluationStyle).
    // Course-wide by design: any approved professor may edit a course's judges.
    match /judgeOverrides/{courseId} {
      allow read: if isAuthenticated();
      allow write: if isApprovedProfessor();
    }
```

- [ ] **Step 2: Deploy the rules**

Run from the project root:

```bash
npx firebase deploy --only firestore:rules
```

Expected: `✔  Deploy complete!` (rules deploy does not load functions, so the CLAUDE.md functions-timeout issue does not apply). If it hangs, fall back to the `/tmp` native-WSL copy pattern from `CLAUDE.md` and deploy `--only firestore:rules` from there.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): allow config read + approved-professor writes to judgeOverrides"
```

---

## Task 5: Frontend data lib + whitelist helper

**Files:**
- Modify: `src/types/content.ts` (add `courseId?` to `Judge`)
- Create: `src/lib/judges.ts`
- Test: `src/lib/judges.test.ts`

- [ ] **Step 1: Add `courseId` to the frontend `Judge` type**

In `src/types/content.ts`, in the `Judge` interface (around line 56), add the optional field:

```ts
export interface Judge {
  judgeId: string;
  courseId?: string;
  name: string;
  avatar: string;
  personality: string;
  evaluationStyle: string;
  focusDimensions: string[];
  promptTemplate: string;
}
```

- [ ] **Step 2: Write the failing test for the whitelist helper**

Create `src/lib/judges.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickOverrideFields, JUDGE_OVERRIDE_FIELDS } from './judges';

describe('pickOverrideFields', () => {
  it('keeps only the four whitelisted persona fields', () => {
    expect([...JUDGE_OVERRIDE_FIELDS]).toEqual(['name', 'avatar', 'personality', 'evaluationStyle']);
  });

  it('drops non-whitelisted fields like provider/model/promptTemplate', () => {
    const out = pickOverrideFields({
      name: 'N', provider: 'gemini', model: 'x', promptTemplate: 'HACK', judgeId: 'j',
    });
    expect(out).toEqual({ name: 'N' });
  });

  it('trims values and drops empty / whitespace-only ones', () => {
    const out = pickOverrideFields({ name: '  Dra. Redes  ', avatar: '   ', personality: '' });
    expect(out).toEqual({ name: 'Dra. Redes' });
  });

  it('ignores non-string values', () => {
    const out = pickOverrideFields({ name: 42 as unknown as string, avatar: '🧠' });
    expect(out).toEqual({ avatar: '🧠' });
  });

  it('returns an empty object when nothing is overridable', () => {
    expect(pickOverrideFields({ foo: 'bar' })).toEqual({});
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/judges.test.ts`
Expected: FAIL — cannot find module `./judges`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/judges.ts`:

```ts
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

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

/** Seeded personas for one course, read from the global config/judges doc. */
export async function fetchCourseJudges(courseId: string): Promise<BaselineJudge[]> {
  const snap = await getDoc(doc(db, 'config', 'judges'));
  if (!snap.exists()) return [];
  const judges = (snap.data().judges || []) as BaselineJudge[];
  return judges.filter((j) => j.courseId === courseId);
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/judges.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/content.ts src/lib/judges.ts src/lib/judges.test.ts
git commit -m "feat(judges): frontend judge/override data lib + whitelist helper"
```

---

## Task 6: The `CourseJudges` editor page

**Files:**
- Create: `src/pages/professor/CourseJudges.tsx`

Reads baseline + overrides, renders one editable card per judge, saves live. Effective value per field = override if present, else baseline. Empty state for courses with no judges (e.g. `temas_emergentes_2026`).

- [ ] **Step 1: Create the page component**

Create `src/pages/professor/CourseJudges.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RotateCcw, Users, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getCourse, type Course } from '../../lib/courses';
import { fetchCourse } from '../../lib/dynamicCourses';
import {
  fetchCourseJudges,
  fetchJudgeOverrides,
  saveJudgeOverrides,
  JUDGE_OVERRIDE_FIELDS,
  type BaselineJudge,
} from '../../lib/judges';

type Draft = Record<string, Record<string, string>>;

export default function CourseJudges() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(courseId ? getCourse(courseId) ?? null : null);
  const [baseline, setBaseline] = useState<BaselineJudge[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    if (!getCourse(courseId)) {
      fetchCourse(courseId).then(setCourse).catch((err) => console.error('Error loading course:', err));
    }
    Promise.all([fetchCourseJudges(courseId), fetchJudgeOverrides(courseId)])
      .then(([judges, overrides]) => {
        setBaseline(judges);
        const initial: Draft = {};
        for (const j of judges) {
          const ov = overrides[j.judgeId] || {};
          initial[j.judgeId] = {
            name: ov.name ?? j.name,
            avatar: ov.avatar ?? j.avatar,
            personality: ov.personality ?? j.personality,
            evaluationStyle: ov.evaluationStyle ?? j.evaluationStyle,
          };
        }
        setDraft(initial);
      })
      .catch((err) => console.error('Error loading judges:', err))
      .finally(() => setLoading(false));
  }, [courseId]);

  const setField = (judgeId: string, field: string, value: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [judgeId]: { ...d[judgeId], [field]: value } }));
  };

  const resetJudge = (j: BaselineJudge) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      [j.judgeId]: {
        name: j.name, avatar: j.avatar, personality: j.personality, evaluationStyle: j.evaluationStyle,
      },
    }));
  };

  const handleSave = async () => {
    if (!courseId || !user) return;
    setSaving(true);
    try {
      await saveJudgeOverrides(courseId, user.uid, draft);
      setSaved(true);
    } catch (err) {
      console.error('Error saving judges:', err);
      alert('Error al guardar los jueces. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const backHref = courseId && getCourse(courseId) ? '/professor' : `/professor/courses/${courseId}`;

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="p-4">
        <Link to={backHref} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors w-fit">
          <ArrowLeft className="w-5 h-5" />
          Volver
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {course && (
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-2">{course.name}</p>
          )}
          <h1 className="text-3xl font-bold mb-2">Jueces del curso</h1>
          <p className="text-white/60 mb-8">
            Personaliza el nombre, el avatar y la personalidad de los jueces que evalúan a los estudiantes.
            Los cambios aplican a <strong>todo el curso</strong>.
          </p>

          {baseline.length === 0 ? (
            <div className="dramatic-card p-8 text-center text-white/50">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              Este curso todavía no tiene jueces configurados.
            </div>
          ) : (
            <>
              <div className="space-y-6 mb-8">
                {baseline.map((j) => (
                  <div key={j.judgeId} className="dramatic-card p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        aria-label="Avatar"
                        value={draft[j.judgeId]?.avatar ?? ''}
                        onChange={(e) => setField(j.judgeId, 'avatar', e.target.value)}
                        className="w-14 h-14 text-3xl text-center bg-white/10 rounded-xl focus:ring-2 focus:ring-cyan-400 outline-none"
                        maxLength={4}
                      />
                      <input
                        aria-label="Nombre"
                        value={draft[j.judgeId]?.name ?? ''}
                        onChange={(e) => setField(j.judgeId, 'name', e.target.value)}
                        className="flex-1 text-lg font-bold bg-white/10 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-400 outline-none"
                      />
                      <button
                        onClick={() => resetJudge(j)}
                        title="Restaurar valores originales"
                        className="flex items-center gap-1 px-3 py-2 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restaurar
                      </button>
                    </div>

                    <label className="block text-sm text-white/50 mb-1">Personalidad</label>
                    <textarea
                      value={draft[j.judgeId]?.personality ?? ''}
                      onChange={(e) => setField(j.judgeId, 'personality', e.target.value)}
                      rows={4}
                      className="w-full bg-white/10 rounded-lg px-3 py-2 mb-4 text-sm focus:ring-2 focus:ring-cyan-400 outline-none resize-y"
                    />

                    <label className="block text-sm text-white/50 mb-1">Estilo de evaluación</label>
                    <textarea
                      value={draft[j.judgeId]?.evaluationStyle ?? ''}
                      onChange={(e) => setField(j.judgeId, 'evaluationStyle', e.target.value)}
                      rows={4}
                      className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-400 outline-none resize-y"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="primary-button w-full py-4 text-lg flex items-center justify-center gap-3"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : saved ? (
                  <>
                    <Check className="w-5 h-5" />
                    Guardado
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Guardar jueces
                  </>
                )}
              </button>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Type-check the frontend build**

Run: `npx tsc -b`
Expected: no errors. (This compiles the new page against the lib + types from Task 5.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/professor/CourseJudges.tsx
git commit -m "feat(judges): CourseJudges editor page"
```

---

## Task 7: Routing + entry points

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/professor/CourseHome.tsx`
- Modify: `src/pages/professor/Dashboard.tsx`

- [ ] **Step 1: Add the route**

In `src/App.tsx`, add the import next to the other professor page imports (after the `CourseHome` import at line 19):

```tsx
import CourseJudges from './pages/professor/CourseJudges';
```

Then add the route inside `<Routes>`, next to the other `/professor/courses/:courseId/...` routes (e.g. after the `sessions/:sessionId/edit` route around line 122):

```tsx
      <Route
        path="/professor/courses/:courseId/judges"
        element={user ? <ProfessorGate><CourseJudges /></ProfessorGate> : <Navigate to="/" replace />}
      />
```

- [ ] **Step 2: Add the entry link on CourseHome (dynamic courses)**

In `src/pages/professor/CourseHome.tsx`, add a link in the `<div className="space-y-3">` action block (after the "Nueva sesión con asistente IA" link, around line 103). Also add `Users` to the `lucide-react` import at the top:

```tsx
import { ArrowLeft, Plus, Play, Pencil, FileText, Users } from 'lucide-react';
```

Link to add:

```tsx
            <Link
              to={`/professor/courses/${courseId}/judges`}
              className="w-full py-4 text-lg flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-semibold"
            >
              <Users className="w-5 h-5" />
              Jueces del curso
            </Link>
```

- [ ] **Step 3: Give built-in course cards a Jueces entry on the Dashboard**

In `src/pages/professor/Dashboard.tsx`, the built-in course card is currently a single full-card `<Link>` (lines ~91–111). Nesting a second `<Link>` inside an anchor is invalid HTML, so convert that card to a `<div>` with two explicit action links. Replace the entire `builtinCourses.map(...)` block (lines ~88–112) with:

```tsx
            {builtinCourses.map((course) => {
              const sessionCount = getSessionsForCourse(course.id).length;
              return (
                <div key={course.id} className="dramatic-card p-6 group">
                  <div className={`w-14 h-14 ${course.iconClass} rounded-xl flex items-center justify-center mb-4`}>
                    <BookOpen className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{course.name}</h3>
                  <p className="text-white/60 text-sm mb-4">{course.tagline}</p>
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="text-white/50">
                      {sessionCount} {sessionCount === 1 ? 'sesion' : 'sesiones'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/professor/courses/${course.id}/create`}
                      className="flex-1 py-2 text-center bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-semibold text-sm"
                    >
                      Crear juego
                    </Link>
                    <Link
                      to={`/professor/courses/${course.id}/judges`}
                      className="flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
                    >
                      <Users className="w-4 h-4" />
                      Jueces
                    </Link>
                  </div>
                </div>
              );
            })}
```

Add `Users` to the `lucide-react` import in `Dashboard.tsx` (keep the existing imports — `BookOpen`, `ChevronRight`, `Plus`, `GraduationCap`, `LogOut`, etc. — and append `Users`).

- [ ] **Step 4: Type-check the frontend build**

Run: `npx tsc -b`
Expected: no errors. (`ChevronRight` may now be unused in `Dashboard.tsx` for the built-in card — if tsc/eslint flags it as unused and it's not used elsewhere in the file, remove it from the import.)

- [ ] **Step 5: Run the frontend lint**

Run: `npm run lint`
Expected: no new errors introduced by the changed files.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/pages/professor/CourseHome.tsx src/pages/professor/Dashboard.tsx
git commit -m "feat(judges): route + Dashboard/CourseHome entry points for course-judges editor"
```

---

## Task 8: Deploy and end-to-end verification

**Files:** none (ops).

- [ ] **Step 1: Re-seed to write `courseId` into config/judges**

Run from the project root (writes to prod Firestore via admin SDK; no override docs are touched):

```bash
node scripts/seed-firestore.cjs
```

Expected: `Seed completed successfully!` and a line like `Total: 6 judges across all courses`.

- [ ] **Step 2: Deploy the functions from the native-WSL copy**

Deploy from `/tmp` (a direct `/mnt/c` deploy times out — see CLAUDE.md). **IMPORTANT:** the CLAUDE.md copy list is stale — it copies only `functions/src/index.ts`, but `firebase.json` has a `predeploy` hook (`npm run build` → `tsc`) that recompiles from source, and `index.ts` now imports several `./lib/*.ts` modules (`scoring`, `judgeModels`, `judgeOverrides`, …). Copy the **entire** `functions/src/` tree, not just `index.ts`, or the predeploy build fails:

```bash
rm -rf /tmp/functions-deploy && mkdir -p /tmp/functions-deploy/functions
cp firebase.json /tmp/functions-deploy/
echo '{"projects":{"default":"ml2-master-game"}}' > /tmp/functions-deploy/.firebaserc
cp functions/package.json functions/package-lock.json functions/tsconfig.json /tmp/functions-deploy/functions/
cp -r functions/src /tmp/functions-deploy/functions/src
cp -r functions/lib /tmp/functions-deploy/functions/lib
cd /tmp/functions-deploy/functions && npm ci
cd /tmp/functions-deploy && npx firebase deploy --only functions
```

Expected: the predeploy `tsc` succeeds, then `Deploy complete!` for `evaluateSubmission` and `processRoundEnd`. (Copying `functions/lib` is belt-and-suspenders; the predeploy hook regenerates it in `/tmp` anyway.)

> Follow-up (not part of this feature): CLAUDE.md's "copy source files" step should be updated to `cp -r functions/src ...` so future deploys don't silently break on the lib split. Flag to Naim.

- [ ] **Step 3: Push the frontend**

```bash
git push -u origin feature/course-judge-customization
```

Then merge to `main` (or open a PR) so GitHub Pages deploys. Rules were already deployed in Task 4.

- [ ] **Step 4: Manual E2E — edit + persist**

As an approved professor:
1. Go to the Dashboard → a course with judges (e.g. AI y Democracia or ML II) → **Jueces**.
2. Rename a judge, change its avatar and personality, click **Guardar jueces**. Expect the "Guardado" confirmation.
3. Reload the page. Expect the edited values to persist (read back from `judgeOverrides/{courseId}`).
4. In the Firebase console, confirm `judgeOverrides/{courseId}` contains only the four persona fields per judge plus `updatedAt`/`updatedBy` — no `provider`/`model`/`promptTemplate`.

- [ ] **Step 5: Manual E2E — override reaches evaluation**

1. Create a game for that course, join as a student, submit a ranked-round answer.
2. After scoring, open the student result / evaluation detail and confirm the evaluating judge shows the **new name/avatar** (persona flows through `{{name}}` etc.).
3. Confirm scores still compute normally (provider/model unchanged — the panel still runs gpt-5 / claude-sonnet-5 / gemini-2.5-pro).

- [ ] **Step 6: Finalize**

Use the `superpowers:finishing-a-development-branch` skill to merge/PR and clean up.

---

## Notes for the implementer

- **Deploy order matters:** rules (Task 4) and re-seed (Task 8.1) must land before students hit the new eval path, but they're backward-compatible — `loadJudgeOverrides` returns `null` for any course without an override doc, and `applyJudgeOverrides(judges, null)` is a no-op, so old games and un-edited courses behave exactly as before.
- **`courseId` on old games:** games created before this change have no `game.courseId` → `loadJudgeOverrides(undefined)` returns `null` → baseline judges. No migration needed.
- **Whitelist is duplicated** intentionally in `functions/src/lib/judgeOverrides.ts` and `src/lib/judges.ts` (backend and frontend can't share a module). Both list exactly `name, avatar, personality, evaluationStyle`; keep them in sync. The backend copy is the security-critical one.
- **Shared built-in courses:** any approved professor editing `ml2-2025`/`ai_democracy_2026` affects all professors running that course (documented caveat in the spec). Per-professor isolation would re-key the override doc; out of scope here.
```
