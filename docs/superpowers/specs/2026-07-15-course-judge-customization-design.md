# Course-level judge customization — design spec

**Date:** 2026-07-15
**Status:** Approved design, ready for implementation plan

## Problem

Judge personas are global and only editable through the repo. Each course's judges live in
`content/courses/<courseId>/judges.json`, get merged into the single Firestore doc
`config/judges` by `scripts/seed-firestore.cjs`, and reach production only after a manual
seed run. There is no frontend editor. A professor cannot rename a judge or adjust its
persona without a code change and a re-seed.

This feature gives professors a UI to customize their course's judges — starting with **name,
avatar, personality, and evaluation style** — with edits that persist **for the entire course**
and take effect **live**, without a re-seed or a functions deploy.

## Scope

### In scope (v1)

- Editable fields: `name`, `avatar`, `personality`, `evaluationStyle`.
- Persistence grain: **course-wide**. One professor edit applies to every session and every
  game of that course, going forward.
- A dedicated "Jueces del curso" editor page, reached from the course/professor dashboard.
- Backend merge of overrides over the seeded baseline at evaluation time.
- Data model that cleanly extends to `provider`, `model`, and `weights` later.

### Out of scope (v1, but designed for)

- Editing `provider` / `model` (cost + correctness implications; the current multi-model panel
  was deliberately cost-balanced). Deferred, with an admin/verified guard planned when surfaced.
- Editing `weights` (bounded/safe, but not surfaced yet).
- Editing `promptTemplate` — stays global. Never surfaced; protecting it protects the JSON
  contract the scoring engine depends on.
- Adding/removing judges, or changing which judges a session uses.
- Per-professor isolation of a shared course's judges (see Open Caveat).

## Decisions settled during brainstorming

1. **Persistence grain = course-wide** (not per-game, not per-session). Judges are already
   conceptually per-course.
2. **Editable scope (v1) = name + avatar + personality + evaluationStyle.** Provider/model and
   weights live in the data model but are not surfaced.
3. **Editor location = a dedicated course-judges page**, not an inline panel on CreateGame.
4. **Merge timing = live at eval time** (not snapshot-onto-game-at-creation), for consistency
   with course-wide persistence.

## Verified facts about the current system

- `content/courses/*/judges.json` defines each course's judges. Fields per judge: `judgeId`,
  `provider`, `model`, `name`, `avatar`, `personality`, `evaluationStyle`, `promptTemplate`,
  `focusDimensions`.
- `scripts/seed-firestore.cjs` merges all courses' judges into the **single** Firestore doc
  `config/judges`, keyed by `judgeId`. It enforces that **judgeIds are globally unique**.
- `config/judges` is a flat union across courses; today a judge record does **not** carry
  `courseId`.
- Judge sets are disjoint per course today: `ml2-2025` = `technical_expert`, `public_sector`,
  `professor_twin`; `ai_democracy_2026` = `democracy_scholar`, `policy_lawyer`,
  `professor_twin_ayd`; `temas_emergentes_2026` = **none**.
- Per-session judge tuning already exists and is already merged at eval time:
  `functions/src/index.ts:302-322` reads `sessionConfig.judgeConfig[judgeId]` (`sessionLens`,
  `weightFormula`) and `sessionConfig.judges` (weights). This is the precedent this feature
  extends.
- Both eval call sites resolve judges the same way — `judgeWeights.map(jw => lookup
  config/judges by judgeId)` → `activeJudges` → `buildJudgeClients(activeJudges)` →
  `evaluateWithJudge(...)`:
  - `evaluateSubmission`: `functions/src/index.ts:565`
  - `processRoundEnd`: `functions/src/index.ts:674`
- `buildJudgeClients` reads `provider`/`model`, so any override affecting those (not in v1)
  must be applied **before** it. Name/avatar/persona are consumed later via prompt template
  substitution (`{{name}}`, `{{personality}}`, `{{evaluationStyle}}`).
- The game doc snapshots `sessionConfig` at creation (`CreateGame.tsx:75`) and carries
  `courseId`, so the backend knows the course at eval time.
- The frontend has **no access to judge personas today** — they exist only in Firestore
  `config/judges`, not bundled into the app (`src/` references only the `Judge` *type*, not
  the data).

## Architecture

### 1. Storage — `judgeOverrides/{courseId}`

A new top-level Firestore collection, one doc per course:

```
judgeOverrides/ml2-2025
{
  "technical_expert": {
    "name": "Dra. Redes",
    "avatar": "🧠",
    "personality": "…",
    "evaluationStyle": "…"
  },
  "public_sector": { … },
  "updatedAt": <timestamp>,
  "updatedBy": "<uid>"
}
```

Rationale:
- **Keyed by course**, so it holds course-wide state directly.
- **Independent of course type** — works whether the course is built-in (bundled, no
  `courses/<id>` doc) or AI-built (has one).
- **Separate from `config/judges`** — the seeded baseline and the live overrides stay layered.
  A future `seed-firestore.cjs` run never clobbers a professor's edits.
- Each override doc holds only whitelisted fields plus `updatedAt`/`updatedBy` metadata.
  `provider`, `model`, `promptTemplate`, `focusDimensions` remain owned by `config/judges`.

**Seed change:** `seed-firestore.cjs` adds a `courseId` field to each judge record it writes
into `config/judges`. It already iterates per course, so it has the value. This lets both the
editor and the backend scope judges to a course without indirecting through session configs.

### 2. Backend merge — `applyJudgeOverrides` helper

A new pure helper (colocated with judge logic, e.g. `functions/src/lib/`):

```ts
const JUDGE_OVERRIDE_FIELDS = ['name', 'avatar', 'personality', 'evaluationStyle'] as const;

function applyJudgeOverrides(
  judges: Judge[],
  overrides: Record<string, Partial<Judge>> | undefined
): Judge[] {
  if (!overrides) return judges;
  return judges.map(j => {
    const ov = overrides[j.judgeId];
    if (!ov) return j;
    const picked: Partial<Judge> = {};
    for (const f of JUDGE_OVERRIDE_FIELDS) {
      if (typeof ov[f] === 'string' && ov[f]) picked[f] = ov[f];
    }
    return { ...j, ...picked };
  });
}
```

- The **hardcoded field whitelist is the safety boundary.** Even if an override doc contains
  `provider`, `model`, or `promptTemplate` (hand-edited or malicious), the merge ignores them —
  no override can change the model or break the JSON contract.
- Unknown `judgeId` keys in the override doc are ignored (no matching judge).
- Empty/missing fields fall through to the baseline.

**Call sites.** In both `evaluateSubmission` and `processRoundEnd`, after `activeJudges` is
resolved from `config/judges` and **before** `buildJudgeClients`:

```ts
const overridesSnap = await db.doc(`judgeOverrides/${game.courseId}`).get();
const mergedJudges = applyJudgeOverrides(activeJudges, overridesSnap.data());
const clients = await buildJudgeClients(mergedJudges);
// … evaluateWithJudge(clients, judge, …) for judge of mergedJudges
```

- One extra Firestore read per eval, co-located with the existing `config/judges` read.
- **Live at eval time:** a mid-course edit affects subsequent rounds/games of that course.
  Already-scored submissions are never re-scored.

### 3. Frontend — "Jueces del curso" page

A dedicated page reached from the course/professor dashboard (game creation stays unchanged).

- **Load:** read `config/judges`, filter to the course by the new `courseId` field; read
  `judgeOverrides/{courseId}`; overlay to compute the current effective persona per judge.
- **Render:** one card per judge with editable `name`, `avatar` (emoji), `personality`,
  `evaluationStyle`. Show the seeded baseline as placeholder / reset target so a professor can
  always see and revert to the original persona.
- **Save:** write the whole override doc to `judgeOverrides/{courseId}` (with `updatedAt`,
  `updatedBy`). No seed run, no functions deploy — edits are live immediately.
- **Empty state:** `temas_emergentes_2026` (0 judges) shows a "this course has no judges yet"
  message.

### 4. Security & Firestore rules

- **Read `config/judges`:** authenticated read. Personas are not sensitive. Verify/add a rule.
- **Write `judgeOverrides/{courseId}`:** gated to approved professors, reusing the existing
  multi-professor approval gate. Rules gate *who*; the code-side field whitelist (§2) gates
  *what*.
- **Read `judgeOverrides/{courseId}`:** authenticated read (the backend reads it; the editor
  reads it).

## Deployment / ops

- One-time `node scripts/seed-firestore.cjs` run to add the `courseId` field to `config/judges`.
- Functions deploy (merge logic + rules) — via the `/tmp` native-WSL copy path in `CLAUDE.md`;
  a direct `/mnt/c` deploy times out.
- Frontend deploy via git push to `main` (GitHub Pages).
- Firestore rules deploy for the new collection + `config/judges` read.

## Testing

- **`applyJudgeOverrides` unit tests:** no override doc; partial override (only `name`);
  full override; unknown `judgeId` ignored; non-whitelisted field (`provider`) ignored;
  empty-string field falls through to baseline.
- **Merge integration sanity:** an override doc changes the persona seen by the prompt without
  altering `provider`/`model`/`promptTemplate`.

## Extensibility

Surfacing `provider`/`model`/`weights` later is: add the field to `JUDGE_OVERRIDE_FIELDS` (and,
for provider/model, apply before `buildJudgeClients` — already the case) plus a form control
in the editor, with the admin/verified guard for provider/model. The store and merge shape
do not change.

## Open caveat (flagged, not blocking)

For built-in shared courses (`ml2-2025`, `ai_democracy_2026`), any approved professor's edit
applies to **every** professor running that course — the literal meaning of "persist for the
entire course." If per-professor isolation is wanted later, the override doc would key by
`{courseId}_{ownerUid}` (or nest under the professor), and the merge would resolve the game
host's uid. Not built in v1.
