# Multi-Professor Access — Design Spec

**Fecha:** 2026-07-05
**Estado:** Aprobado en brainstorming, pendiente de plan de implementación

## Objetivo

Que cualquier profesor pueda usar Aula Maestra para sus propios cursos, entrando con su cuenta de Google, sin programar nada. Naim aprueba manualmente cada solicitud de profesor (control de gasto de API OpenAI). Un asistente IA genera el contenido del curso (escenarios, rúbrica, knowledge base) como borrador editable.

## Contexto técnico (verificado en el código)

- El login con Google ya existe (`signInWithPopup`, `src/lib/firebase.ts`). Las rutas `/professor/*` solo chequean "usuario logueado" — **hoy cualquier usuario autenticado puede crear juegos**.
- Los cursos/sesiones están hardcodeados en `src/lib/courses.ts` (imports build-time de `content/sessions/*`).
- La creación de juegos es **client-side**: `CreateGame.tsx` hace `setDoc` directo a `games/{code}` con el contenido completo (config + rubric + scenarios + knowledgeBase) embebido en el doc del juego. El motor es agnóstico al origen del contenido en runtime.
- No existe cloud function `createGame`. El gate de seguridad debe ir en `firestore.rules`.
- Los jueces viven en el doc global `config/judges` (seed vía `seedJudges`). `evaluateSubmission` usa `sessionConfig.judges` con fallback al trío `technical_expert` / `public_sector` / `professor_twin`. Cada sesión personaliza jueces vía `sessionConfig.judgeConfig[judgeId].sessionLens` y `weightFormula`.
- `firestore.rules` ya esboza una colección `courses` con `professorId` (nunca usada por el frontend); se actualiza para el flujo real.

## Decisiones de diseño

1. **Acceso**: solicitud + aprobación manual del admin (Naim). No auto-servicio, no códigos de invitación.
2. **Autoría**: asistente IA genera borrador de sesión completo; el profesor edita en formularios y publica. No se exige escribir JSON.
3. **Jueces**: las sesiones generadas reutilizan el trío genérico global (`technical_expert`, `public_sector`, `professor_twin`); la personalización por curso va en `judgeConfig.sessionLens` generado por el asistente. No se crean jueces nuevos por curso en v1.
4. **Cursos existentes**: los 3 cursos hardcodeados quedan intactos en `courses.ts` y son visibles solo para el admin. Cero migración, cero riesgo para clases en curso.
5. **Admin**: `naim.bro@gmail.com` hardcodeado como constante compartida (frontend + firestore.rules + functions).

## Modelo de datos (Firestore)

### `professors/{uid}`
```
{
  uid, email, displayName,
  institution: string,        // del formulario de solicitud
  motivation: string,         // qué curso quiere crear
  status: 'pending' | 'approved' | 'rejected',
  requestedAt, reviewedAt
}
```

### `courses/{courseId}` (auto-id)
```
{
  name, shortName, tagline,
  color: string,              // key de paleta predefinida → accentClass/iconClass
  professorId: uid,
  createdAt, updatedAt
}
```

### `courses/{courseId}/sessions/{sessionId}` (auto-id)
```
{
  title, description,
  status: 'draft' | 'ready',
  config: {...},              // mismo esquema que content/sessions/*/config.json
  scenarios: [...],           // mismo esquema que scenarios.json
  rubric: {...},              // mismo esquema que rubric.json (dimensions con level_100..level_0)
  knowledgeBase: string,      // markdown
  generatedBy: 'ai',
  createdAt, updatedAt
}
```

Los esquemas de `config`/`scenarios`/`rubric` son idénticos a los archivos actuales para que `CreateGame` y el pipeline de jueces funcionen sin cambios.

## Flujos

### 1. Solicitud de profesor
1. Home → botón "Soy profesor" → login Google → `/professor`.
2. Si el usuario no es admin y no tiene doc en `professors/`: pantalla de solicitud (institución + qué curso quiere crear). Al enviar se crea `professors/{uid}` con `status: 'pending'`.
3. Si `status: 'pending'`: pantalla "Solicitud en revisión".
4. Si `status: 'approved'`: Dashboard normal.
5. Si `status: 'rejected'`: mensaje con contacto.

### 2. Panel de admin (`/professor/admin`)
- Solo visible/accesible para el admin.
- Lista solicitudes `pending` con nombre, email, institución, motivación → botones Aprobar / Rechazar (update de `status`).
- Lista profesores aprobados (informativa).

### 3. Crear curso (profesor aprobado)
1. Dashboard → "Crear curso" → formulario: nombre, tagline, color (selector de paleta).
2. Se crea el doc `courses/{courseId}`. El curso aparece en su Dashboard.

### 4. Generar sesión con asistente IA
1. Dentro del curso → "Nueva sesión" → formulario: título, tema/descripción (textarea libre), audiencia, número de rondas (2–6), minutos por ronda, idioma.
2. Llama a la nueva cloud function `generateSessionDraft` → crea la sesión con `status: 'draft'`.
3. Editor de sesión: campos editables por ronda (título, prompt del escenario), rúbrica (nombre/descripción/pesos de dimensiones, texto de niveles), knowledge base (textarea markdown), lentes de jueces (avanzado, colapsado).
4. Botón "Publicar" → `status: 'ready'` → habilita crear juegos con esa sesión.
5. "Regenerar" disponible mientras es draft (sobrescribe con confirmación).

### 5. Crear juego desde curso dinámico
- `CreateGame.tsx` detecta si `courseId` es hardcodeado (usa `SESSIONS` como hoy) o dinámico (lee sesiones `ready` desde Firestore, las adapta a la misma forma `SessionOption`). El `setDoc` del juego no cambia.

## Cloud function nueva: `generateSessionDraft`

- `onCall`, región us-central1, secret `OPENAI_API_KEY` (misma infra que jueces).
- Input: `{ courseId, title, topicDescription, audience, roundCount, roundMinutes, language }`.
- Validación: caller autenticado + `professors/{uid}.status == 'approved'` (o admin) + `courses/{courseId}.professorId == uid`.
- Prompt al LLM: genera JSON con `config` (incluye `judges` trío genérico + `judgeConfig` con `sessionLens` por juez adaptado al tema), `scenarios` (uno por ronda, con `id`, `title`, `prompt`, `judgeFocus`), `rubric` (3 dimensiones con pesos y niveles 100→0) y `knowledgeBase` (markdown, ~800-1500 palabras sobre el tema).
- Usa response_format JSON + validación de esquema en la function; si falla el parseo, reintenta una vez y si no, error claro al cliente.
- Escribe el doc de sesión en Firestore y retorna `{ sessionId }`.

## Cambios en `firestore.rules`

```
function isAdmin() { return request.auth.token.email == 'naim.bro@gmail.com'; }
function isApprovedProfessor() {
  return isAdmin() ||
    get(/databases/$(db)/documents/professors/$(request.auth.uid)).data.status == 'approved';
}
```

- `professors/{uid}`: create solo el propio uid con `status == 'pending'`; read propio + admin; update/delete solo admin.
- `courses/{courseId}`: read autenticados; create si `isApprovedProfessor()` y `professorId == request.auth.uid`; update/delete solo dueño o admin.
- `courses/{courseId}/sessions/{id}`: read autenticados (los estudiantes no las leen — el contenido viaja embebido en el juego — pero simplifica); write solo dueño del curso o admin.
- `games/{code}`: **create pasa de "autenticado" a `isApprovedProfessor()`** (cierra el hueco actual de gasto de API). Read/updates de estudiantes no cambian.

## Frontend — archivos nuevos / modificados

**Nuevos:**
- `src/pages/professor/RequestAccess.tsx` — formulario de solicitud + estados pending/rejected.
- `src/pages/professor/AdminPanel.tsx` — aprobación de solicitudes.
- `src/pages/professor/CourseForm.tsx` — crear/editar curso.
- `src/pages/professor/SessionBuilder.tsx` — formulario de generación IA + editor del borrador.
- `src/hooks/useProfessor.ts` — estado del doc professor (pending/approved) + helper isAdmin.
- `src/lib/dynamicCourses.ts` — lectura de cursos/sesiones Firestore y adaptación a `Course`/`SessionOption`.

**Modificados:**
- `src/App.tsx` — rutas nuevas + guard de profesor (redirige a RequestAccess si no aprobado).
- `src/pages/professor/Dashboard.tsx` — merge cursos hardcodeados (solo admin) + cursos Firestore del profesor; botón "Crear curso"; link admin.
- `src/pages/professor/CreateGame.tsx` — soporte de cursos dinámicos.
- `src/pages/student/Home.tsx` — sin cambios: ya tiene el acceso "Panel del Profesor" que navega a `/professor`; el guard nuevo redirige desde ahí.

## Manejo de errores

- Generación IA falla → mensaje claro + botón reintentar; no queda sesión corrupta (la function escribe solo si el JSON valida).
- Profesor no aprobado intenta crear juego → las rules lo rechazan; la UI ni siquiera muestra la opción.
- Sesión `draft` no aparece en la lista de crear juego.

## Testing

- `npm run build` (frontend) y `cd functions && npm run build` sin errores.
- Prueba manual del flujo completo con una segunda cuenta Google: solicitar → aprobar (como admin) → crear curso → generar sesión → editar → publicar → crear juego → jugar una ronda con evaluación de jueces reales.
- Verificar que un usuario no aprobado NO puede crear un doc en `games/` (probar desde consola del navegador).
- Los cursos hardcodeados siguen funcionando igual para el admin.

## Fases de implementación

1. **Fase A — Cuentas y cursos**: professors + solicitud + admin panel + rules + courses en Firestore + Dashboard/CreateGame dinámicos. (Valor: cierra el hueco de seguridad y habilita multi-profesor con contenido manual vía consola.)
2. **Fase B — Asistente IA**: `generateSessionDraft` + SessionBuilder (generación + edición + publicar).

## Fuera de alcance (v1)

- Cuotas de uso por profesor (la aprobación manual es el control).
- Jueces personalizados por curso (se reutiliza el trío genérico con lentes).
- Migración de los cursos hardcodeados a Firestore.
- Notificaciones por email al aprobar/solicitar.
- Edición de sesiones ya publicadas con juegos en curso (se permite editar, los juegos ya creados no se ven afectados porque el contenido viaja embebido).
