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
