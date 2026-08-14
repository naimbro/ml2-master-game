# CLAUDE.md - Project Instructions for Claude Code

## CRITICAL: Firebase Functions Deployment from WSL

**This project lives on the Windows filesystem (`/mnt/c/...`) but runs tools from WSL.**

WSL's cross-filesystem I/O to NTFS is extremely slow for Node.js module resolution. Loading `functions/lib/index.js` takes ~26 seconds from `/mnt/c/` vs ~0.3 seconds from native WSL filesystem. Firebase CLI has a 10-second discovery timeout, so **`firebase deploy --only functions` will ALWAYS fail when run directly from this project directory.**

### Solution: Deploy from native WSL filesystem

```bash
# 1. Copy source files (NOT node_modules) to /tmp
rm -rf /tmp/functions-deploy
mkdir -p /tmp/functions-deploy/functions

# 2. Copy firebase config
cp firebase.json /tmp/functions-deploy/
echo '{"projects":{"default":"ml2-master-game"}}' > /tmp/functions-deploy/.firebaserc

# 3. Copy the ENTIRE functions source + built output.
#    IMPORTANT: firebase.json has a `predeploy` hook (`npm run build` -> tsc) that
#    recompiles from source, and functions/src/index.ts imports several ./lib/*.ts
#    modules (scoring, judgeModels, judgeOverrides, ...). Copy the whole src tree
#    (NOT just index.ts) or the predeploy build fails on the missing lib sources.
cp functions/package.json functions/package-lock.json functions/tsconfig.json /tmp/functions-deploy/functions/
cp -r functions/src /tmp/functions-deploy/functions/src
cp -r functions/lib /tmp/functions-deploy/functions/lib

# 4. Install dependencies on native fs (fast)
cd /tmp/functions-deploy/functions && npm ci

# 5. Deploy from native fs (predeploy tsc runs here, then upload)
cd /tmp/functions-deploy && npx firebase deploy --only functions
```

**Do NOT attempt `firebase deploy` directly from `/mnt/c/...` - it will timeout every time.**

> Firestore rules deploy fine directly from the project dir (they don't load functions):
> `npx firebase deploy --only firestore:rules`.

## Calibrar una rúbrica: no hace falta ninguna clave de API

Al escribir una sesión aparece la tentación de correr respuestas sintéticas por
los jueces desde un script local, y para eso pedir las claves con
`firebase functions:secrets:access`. **No se hace, por dos razones.**

La primera es que **no mediría lo que se cree que mide**. El prompt del juez se
arma inline dentro de `evaluateSubmission` en `functions/src/index.ts` y no está
exportado: `functions/lib` sólo expone `splitPrompt` y `resolveDimensionWeights`.
Un script local tendría que reconstruirlo, y a la primera edición del prompt
desplegado quedaría midiendo otra cosa — en silencio, que es la peor forma.

La segunda es que las claves de OPENAI/ANTHROPIC/GEMINI facturan de verdad y
quedarían escritas en el transcript de la sesión.

**La forma correcta de medir una rúbrica es a través de `evaluateSubmission`
desplegado**, que no necesita ninguna clave del lado del cliente: es una
`https.onCall` autenticada y las claves las inyecta Firebase. En la práctica eso
son dos caminos:

- **Jugar la sesión y mandar a propósito las respuestas sintéticas.** Es lo más
  rápido y de paso prueba el camino completo. `respuestas_sinteticas.md` en la
  carpeta de la sesión trae las respuestas ya escritas.
- Un script que cree una partida de prueba, escriba las submissions y llame a
  `evaluateSubmission`. Necesita un ID token de Firebase Auth, no una API key.

Lo que sí queda escrito offline —y lo cubre
`scripts/verify-session-prompt.cjs`— es el **cableado**: que el knowledge base
llegue, que los pesos difieran, que los techos sean ejecutables. Lo que ningún
chequeo offline puede decir es **qué puntaje va a poner el panel**.

## El compás — instrumento de posicionamiento (agosto 2026)

Vive en `content/compas/` y en `src/lib/compas*.ts`, `src/pages/compas/`. **No es
una sesión de juego** y por eso no está bajo `content/sessions/`: se intentó
primero así y no cabe, porque `validate-content.cjs` exige `correctOptionIndex`
en toda pregunta de alternativas y un ítem del compás no tiene respuesta
correcta. Inventarle una no es cosmético — `mcScoring.ts` la puntúa y
`Results.tsx` la muestra en el leaderboard.

**Leer `content/compas/README.md` antes de tocar nada de esto.** Ahí está el
detalle: el esquema, las rutas, dónde vive cada dato y por qué.

### Las cuatro reglas que no se negocian

1. **No puntúa, no rankea, no entra en la nota.** En cuanto un alumno sospecha
   que alguna alternativa suma, deja de responder lo que piensa y la medición de
   fin de semestre queda arruinada sin que nadie lo note. No hay un solo número
   de puntaje en `src/lib/compas.ts`, y así tiene que seguir.
2. **Los nombres nunca son públicos.** La posición durable lleva uid y no
   nombre, porque esa colección la lee cualquier alumno autenticado. Nombre y
   posición se encuentran sólo en la pantalla del anfitrión (`/compas/:code/campos`).
   Nada proyectado lleva nombres.
3. **El instrumento es fijo entre aplicaciones.** Si se cambia un ítem, sube la
   versión del archivo y las mediciones anteriores dejan de ser comparables.
4. **La comparación es pareada.** Sólo entran quienes respondieron las dos
   aplicaciones, y los que faltan se cuentan a la vista. Promediar todos los de
   agosto contra todos los de noviembre compara dos grupos distintos de personas.

### Estado real

Probado: 534 tests en verde, `tsc -b` y eslint limpios, y las pantallas
verificadas corriendo en `/preview-compas` (vista previa con curso simulado, sin
login — es el hermano de `MCRepartoPreview`).

**Nunca lo ha jugado gente real.** Falta la corrida en seco: abrir sala, entrar
con dos cuentas, avanzar ítems, cerrar. Dos cosas a mirar ahí, que son las que
no se pueden verificar solo:
- el contador «X de Y han respondido» compara `respondidas >= itemIndex`, así que
  quien se saltó un ítem antes queda contado como atrasado para siempre;
- si la regla de lectura de `respuestas` falla, el plano del anfitrión queda **en
  blanco sin decir por qué**.

### Pendiente conocido

- **Recalibrar los cortes de la grilla** con terciles empíricos después de la
  primera aplicación real. Los que están son números redondos escritos a ojo, y
  como la posición es el promedio de diez ítems casi nadie llega a los extremos.
  Mismo problema que `timeLimitSeconds`: sólo lo resuelve una clase de verdad.
  `tercilesDe()` en `src/lib/compas.ts` está para eso.
- Dos opciones marcadas `ANCLA DEBIL` en `instrumento_v1.json`: la posición
  existe en el debate chileno pero ningún texto del programa la defiende.

### Trampas del entorno que costaron tiempo

- **`npx vite` no arranca con el node por defecto de WSL** (v18): Vite 7 necesita
  `crypto.hash`, que llegó en 20.12. El error es `crypto.hash is not a function`
  y no menciona la versión. Levantar con
  `export PATH=$HOME/.nvm/versions/node/v20.19.5/bin:$PATH`.
- No hay `node` del lado Windows: todo tooling va por `wsl.exe -e bash -lc`.
- El repo suele tener trabajo sin commitear de otras sesiones, y algo de eso
  **no compila** (`MCRepartoPreview.tsx` tenía un error de tipos que rompía
  `npm run build`). Antes de commitear, revisar el índice y **construir el commit
  en un worktree aparte** (`git worktree add /tmp/x HEAD` + symlink a
  `node_modules`), que es lo que hace CI. Empujar sin eso puede romper el deploy
  con código ajeno.

## Project Overview

- **Stack**: React + TypeScript + Vite (frontend), Firebase Cloud Functions (backend), Firestore (database)
- **Firebase project**: `ml2-master-game`
- **Hosting**: GitHub Pages via GitHub Actions (push to `main` triggers deploy)
- **Functions region**: `us-central1`

## Build Commands

- Frontend: `npm run build` (from project root)
- Functions: `cd functions && npm run build`
- Frontend dev: `npm run dev`

## Key Directories

- `src/` - React frontend
- `functions/src/` - Cloud Functions (single file: `index.ts`)
- `content/sessions/` - Session content (scenarios, rubrics, knowledge bases)
- `content/compas/` - El compas: instrumento de opinion, NO es una sesion (ver arriba)
- `functions/lib/` - Compiled JS output (committed to repo, needed for deploy)
- `.claude/skills/` - Skills de autoría de este proyecto (ver abajo)

## Skills de autoría — usarlos, no improvisar

Tres skills versionados en `.claude/skills/` cubren el trabajo de construir un
juego. **Invocarlos con la herramienta `Skill` apenas la tarea calce**, antes de
abrir archivos de contenido: llevan adentro reglas que salieron de fallas reales
y que no se deducen leyendo el repo.

| Skill | Cuándo |
|---|---|
| `autor-de-contenido` | Escribir o cambiar las preguntas de una clase, armar una sesión nueva, agregar o editar una ronda. Entrevista a Naim y le ofrece opciones; nunca entrega una sola versión. |
| `autor-de-rubricas` | Escribir o arreglar cómo se puntúa: `judgeFocus`, `evaluationGuide`, `idealAnswer`, dimensiones de `rubric.json`, penalizaciones, `sessionLens`, `weightFormula`. Corre **después** de que las preguntas están elegidas. |
| `pulidor-visual` | Cambiar cómo se ve el juego: pantallas bajo `src/pages/`, `src/components/`, `src/index.css`. Muestra opciones renderizadas antes de escribir código. |

Orden normal para un juego nuevo: `autor-de-contenido` → Naim elige →
`autor-de-rubricas` → `pulidor-visual` sobre las pantallas nuevas.

**La regla dura que atraviesa los tres:** cada pregunta sale de una slide,
página o minuto concreto del material que la clase vio, y el juego no afirma
ningún hecho que no esté ahí — tampoco en un distractor. Si falta el hecho, se
cambia la pregunta, no se agrega el hecho.
