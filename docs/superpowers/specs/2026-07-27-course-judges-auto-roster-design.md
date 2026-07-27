# Jueces por curso: roster automático

**Fecha:** 2026-07-27
**Estado:** aprobado

## Problema

La página `/professor/courses/:courseId/judges` está vacía para casi todos los cursos.

`fetchCourseJudges()` (`src/lib/judges.ts`) lee el doc global `config/judges` y filtra por
`judge.courseId === courseId`. Ese doc contiene 6 jueces, etiquetados sólo con dos cursos:

| courseId etiquetado | jueces |
|---|---|
| `ml2-2025` | `technical_expert`, `public_sector`, `professor_twin` |
| `ai_democracy_2026` | `democracy_scholar`, `policy_lawyer`, `professor_twin_ayd` |

Los demás cursos reusan esos judgeIds en vez de definir jueces propios, así que el filtro no
devuelve nada y la UI dice *"Este curso todavía no tiene jueces configurados"*:

- `temas_emergentes_2026` — `content/courses/.../judges.json` tiene `judges: []`; sus sesiones
  usan el trío de AyD.
- `mundial_2026` — no tiene `judges.json`; sus sesiones usan el trío de ml2-2025 y sus personas
  (La DT / El Relator / Profe Naim) viven en `judgeOverrides/mundial_2026`. Se aplican en vivo
  durante la evaluación, pero son invisibles y no editables desde la UI.
- Cursos creados desde el frontend — el asistente IA escribe `config.judges` con el trío de
  ml2-2025 (`functions/src/lib/sessionDraft.ts`), y ningún juez queda etiquetado con el autoid
  del curso.

O sea: no es "repo vs frontend", es "los dos cursos más antiguos vs todo lo demás". Y el gap se
repite cada vez que se crea un curso, por cualquiera de los dos caminos.

## Diseño

El roster de jueces de un curso deja de ser *"los jueces etiquetados con este courseId"* y pasa a
ser *"los jueces que las sesiones de este curso realmente usan"*. Toda sesión —del repo o generada
por el asistente— ya declara `config.judges: [{judgeId, weight}]`, y el backend ya resuelve así en
tiempo de evaluación (`functions/src/index.ts:591`). Esto alinea la UI con lo que el motor hace.

### `src/lib/courseJudgeIds.ts` (nuevo)

Módulo puro, sin imports de Firebase, testeable directo:

```ts
judgeIdsFromSessions(sessions: { config?: { judges?: { judgeId?: string }[] } }[]): string[]
DEFAULT_JUDGE_IDS: readonly string[]  // technical_expert, public_sector, professor_twin
mergeJudgeRoster(tagged, derived, all): BaselineJudge[]
```

`judgeIdsFromSessions` une los `judgeId` de todas las sesiones, dedupe, preserva el orden de
primera aparición, e ignora sesiones sin `config.judges`.

`DEFAULT_JUDGE_IDS` es el trío que el asistente IA le pone a toda sesión nueva; sirve de fallback
para un curso recién creado que todavía no tiene ninguna sesión.

### `fetchCourseJudges(courseId)` reescrito

Un solo `getDoc(config/judges)`, igual que hoy, y después:

1. Jueces con `j.courseId === courseId` (preserva el comportamiento actual de ml2-2025 y AyD).
2. Unión con los jueces referenciados por las sesiones del curso:
   - curso del repo → `getSessionsForCourse(courseId)` de `src/lib/courses.ts`;
   - curso de Firestore → `fetchSessions(courseId)` de `src/lib/dynamicCourses.ts`.
3. Dedupe por `judgeId`, en ese orden (etiquetados primero, derivados después).
4. Si el curso no tiene ninguna sesión → `DEFAULT_JUDGE_IDS`.

Un `judgeId` referenciado por una sesión pero ausente de `config/judges` se ignora en silencio en
la UI; el backend ya emite `console.warn` para ese caso.

### "Restaurar" pasa a significar "deshacer mis ediciones"

`CourseJudges.tsx` resetea hoy al baseline de `config/judges`. Para `mundial_2026` eso convertiría
a **La DT en Dr. Tech**, porque La DT vive en `judgeOverrides`, no en el baseline. Hoy no se nota
porque la página está vacía.

El botón pasa a restaurar el estado **tal como estaba al abrir la página** (baseline + overrides
guardados), que es lo que un profesor espera de "Restaurar" y arregla el caso Mundial sin lógica
nueva: se guarda el draft inicial en un ref y `resetJudge` lee de ahí.

### Lo que NO cambia

- `saveJudgeOverrides` sigue escribiendo en `judgeOverrides/<courseId>`, así que editar
  "Dr. Tech" desde `mundial_2026` **no toca** `ml2-2025`. Cada curso tiene su propia capa.
- Firestore rules, backend, `seed-firestore.cjs` y `seed-judge-overrides.cjs`: intactos.
- `content/courses/<id>/judges.json` pasa a ser **opcional**: sólo hace falta si el curso quiere
  jueces *nuevos*, no si reusa los existentes.

## Automático hacia adelante

- Curso nuevo desde el frontend → el asistente IA escribe `config.judges` → los jueces aparecen
  solos. Antes de la primera sesión, aparece el trío por defecto.
- Curso nuevo desde el repo → basta con que sus sesiones declaren `config.judges` (el validador de
  contenido ya lo exige) → aparecen solos.

## Tests

`src/lib/courseJudgeIds.test.ts`:
- dedupe y orden de primera aparición
- sesiones sin `config`, sin `judges`, o con entradas sin `judgeId`
- lista vacía de sesiones
- `mergeJudgeRoster`: etiquetados primero, derivados después, sin duplicados, ignorando judgeIds
  desconocidos

`src/lib/judges.test.ts`: se mantiene lo existente de `pickOverrideFields`.
