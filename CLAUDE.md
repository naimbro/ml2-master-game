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

Probado: 543 tests en verde, `tsc -b` y eslint limpios, las pantallas
verificadas corriendo en `/preview-compas` (vista previa con curso simulado, sin
login — es el hermano de `MCRepartoPreview`), y **17 pruebas de las reglas contra
el emulador** (`npm run test:rules`).

**La corrida en seco se hizo el 14-ago-2026** (sala `NQ8QGD`, dos cuentas de
verdad) y las dos ramas que no se podían verificar solo quedaron probadas: el
anfitrión leyó las respuestas de otro, y **escribió la posición de otro al
cerrar, con la pestaña del alumno ya muerta** — que es la única forma de saber
que fue el anfitrión y no el propio teléfono. Sigue sin jugarlo un curso
completo.

Lo que esa corrida destapó, y que ningún chequeo previo iba a encontrar: **las
tres puertas de entrada estaban cerradas**. La pantalla proyectada mostraba
`/compas/ABC123` sin dominio ni prefijo, el código tecleado en `/join` devolvía
«Juego no encontrado» porque sólo se buscaba en `games/`, y sin sesión **todas**
las rutas rebotaban a `/` tirando el destino a la basura — que en el teléfono de
un alumno es el caso normal, no el raro. Arreglado en `3c99abf`. Si se agrega
otra pantalla que se entre por QR, `ConSesion` en `App.tsx` es lo que hay que
usar.

**Ojo con probar jugando solo:** si el anfitrión entra con su propia cuenta,
`isOwner(playerId)` calza primero en las reglas y tapa justamente las dos ramas
que importan. Dos corridas se perdieron así. Para eso está `npm run test:rules`,
que las prueba en segundos y sin dos personas.

### Pendiente conocido

- **Recalibrar los cortes de la grilla** con terciles empíricos después de la
  primera aplicación real. Los que están son números redondos escritos a ojo, y
  como la posición es el promedio de diez ítems casi nadie llega a los extremos.
  Mismo problema que `timeLimitSeconds`: sólo lo resuelve una clase de verdad.
  `tercilesDe()` en `src/lib/compas.ts` está para eso.
- Dos opciones marcadas `ANCLA DEBIL` en `instrumento_v1.json`: la posición
  existe en el debate chileno pero ningún texto del programa la defiende.
- **`compas/ai_democracy_2026/ai_democracy_2026_compas_v1_a1/` quedó vacía a
  propósito** el 14-ago-2026: las tres pruebas habían escrito ahí, que es el
  cajón de la Semana 3 de verdad. Dos posiciones falsas en un curso de ~25 mueven
  un tercil, y los terciles son justamente lo que se va a recalcular con esa
  cohorte. Si se vuelve a probar, o se usa otro número de aplicación o se borra
  después — las salas (`compasRuns`) da igual dejarlas.

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

## Colaboradores de un curso — más de un profesor en el mismo curso (agosto 2026)

Hasta acá la propiedad de un curso era **un solo campo**: `courses/{id}.professorId`,
el uid de quien lo creó. Un ayudante que tenía que llevar el registro de un ramo
no tenía ninguna forma de entrar. Ahora el documento del curso lleva además
`colaboradores: string[]`, y quien esté ahí puede **exactamente lo mismo que el
dueño, borrar el curso incluido**.

La lista se administra en la pantalla del curso (`/professor/courses/:id`,
sección «Quién más entra a este curso»). El permiso es **por curso y no por
panel**: compartir «todo mi panel» sería una casilla y compartiría de más —cada
curso que se cree después— sin que nadie se entere.

**La lista guarda MAILS, no uid**, y esa decisión arrastra todo lo demás. Un uid
sólo existe después del primer login: agregar por uid obligaría al profesor a
pedirle al ayudante que entre primero y a averiguar un número que ninguna
pantalla muestra. El costo es que el mail hay que **normalizarlo en las cuatro
puntas** —al guardarlo, al consultarlo, en las reglas y en la function—, porque
la comparación de Firestore es literal: un mail guardado con mayúsculas no calza
nunca con el `request.auth.token.email` de Google, y el ayudante ve un «permiso
denegado» que ninguna pantalla puede explicar. Todo pasa por `normalizarMail()`
en `src/lib/colaboradores.ts`, y las reglas comparan contra `.lower()`.

Las dos trampas que costaron pensarlas, las dos cubiertas por pruebas:

1. **`get('colaboradores', [])` y nunca `course.colaboradores`.** En las reglas,
   leer un campo que no existe hace fallar la regla *entera*. Todos los cursos
   creados antes de esto no tienen el campo: sin el valor por defecto, estrenar
   esta función le habría quitado a cada profesor sus propios cursos.
2. **`email_verified` no es decorativo.** Sin él, cualquiera que consiga una
   cuenta que declare el mail de un ayudante entra a los cursos de su profesor.

Lo único reservado al dueño es no perder el curso: **`professorId` es inmutable
para todos** (regla en `firestore.rules`), porque un colaborador que puede
escribir el resto del documento podría ponerse de dueño y dejar afuera al
profesor. Transferir un curso, si alguna vez hace falta, se hace con el SDK de
admin, donde las reglas no corren.

**Ser colaborador no es una puerta de entrada a la plataforma.** Sigue habiendo
una sola: el ayudante pide acceso en `/professor/solicitar` y el admin lo
aprueba. Hasta entonces el curso no le aparece, y la pantalla lo dice.

### Qué hay que desplegar

Tres cosas, y las tres por separado:

```bash
npx firebase deploy --only firestore:rules      # el permiso de verdad
```

La function `generateSessionDraft` también chequea el curso (es el gemelo de
`puedeEditar()` en las reglas): va por el camino de `/tmp` que está al principio
de este archivo. Y el frontend sale solo con el push a `main`.

### Estado real

Probado: 651 tests de vitest en verde, `tsc -b` y eslint limpios, y **20 pruebas
de las reglas contra el emulador** (`npm run test:rules`, que ahora corre las del
compás y las de colaboradores). Las de colaboradores cubren las dos direcciones
—el ayudante entra, y nadie más entra— porque las dos fallan en silencio: si el
permiso no alcanza, el ayudante ve un panel vacío y concluye que la plataforma
está rota; si alcanza de más, el síntoma es que todo funciona.

**Sin correr con dos cuentas de verdad todavía.** Vale lo mismo que en el compás:
si el profesor prueba con su propia cuenta, entra por `professorId` y la rama que
importa —la del mail— no se toca nunca.

**Ojo con los cursos del repo.** Los seis de `src/lib/courses.ts` (`ml2-2025`,
`ai_democracy_2026`, …) no tienen documento en Firestore y sólo se le muestran al
admin: la lista de colaboradores no los alcanza y la sección no aparece en ellos.
Esto sirve para los cursos creados desde la app.

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
