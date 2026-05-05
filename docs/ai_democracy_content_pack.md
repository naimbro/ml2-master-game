# IA y Democracia 2026 — Guia operativa del content pack

Esta guia esta escrita para **ti como profesor**, no para un ingeniero
full-time. Todo el contenido pedagogico vive en archivos JSON y Markdown
que puedes editar a mano (o con Claude Code) sin tocar el motor.

---

## TL;DR

- Contenido pedagogico: `content/sessions/ai_democracy_2026/`
- Configuracion del curso (estudiantes, fechas): `content/courses/ai_democracy_2026/`
- Jueces (personalidades del LLM evaluador): `content/judges/default_judges.json`
- **No toques** la carpeta `src/` ni `functions/` salvo que quieras cambiar el motor.
- Para validar que tus archivos no rompen el juego: `node scripts/validate-content.cjs ai_democracy_2026`
- Para probar la demo en local: `npm run dev`

---

## Estructura creada

```
content/
├── courses/
│   └── ai_democracy_2026/
│       ├── README.md
│       ├── config.json          # Metadatos del curso
│       └── enrolled.json        # Lista de estudiantes (vacia por ahora)
│
├── sessions/
│   └── ai_democracy_2026/
│       ├── _shared/
│       │   ├── tag_vocabulary.md     # Diccionario de tags forzados
│       │   ├── global_penalties.json # Lista de penalizaciones reusables
│       │   └── base_rubric.json      # Rubrica base (no consumida directamente; cada unidad copia)
│       │
│       ├── unidad_00_demo/           # SESION DEMO FUNCIONAL (lista para probar)
│       │   ├── config.json
│       │   ├── scenarios.json        # 3 escenarios reales
│       │   ├── rubric.json
│       │   └── knowledge_base.md
│       │
│       ├── unidad_01_backlash/       # PLACEHOLDER (1 escenario TODO)
│       ├── unidad_02_populismo_ia/
│       ├── unidad_03_sociedad_bots/
│       ├── unidad_04_orwell/
│       ├── unidad_05_democracia_deliberativa/
│       └── unidad_06_regulacion/
│
└── judges/
    └── default_judges.json           # 6 jueces totales (3 ML2 + 3 AyD)
```

Las unidades 01-06 tienen archivos validos pero contenido marcado `_TODO`
o `[PLACEHOLDER]`. El juego carga sin errores; solo no usar en clase real
hasta completar.

---

## Como agregar una nueva sesion (o reemplazar un placeholder)

Cada sesion vive en `content/sessions/ai_democracy_2026/{nombre_sesion}/` con
4 archivos:

1. `config.json` — id, titulo, duracion, jueces y pesos por juez
2. `scenarios.json` — array de escenarios (rondas)
3. `rubric.json` — dimensiones de evaluacion + penalizaciones globales
4. `knowledge_base.md` — material de referencia que ven los jueces

**Para arrancar desde cero:** copia la carpeta `unidad_00_demo` completa,
renombrala (ej: `unidad_01_backlash`), y edita los 4 archivos.

**Para reemplazar un placeholder:** abre los archivos de la unidad
correspondiente y reemplaza los `_TODO` y `[PLACEHOLDER]` por contenido
real. Los placeholders ya tienen el schema completo, solo hay que
sustituir.

Luego:

```bash
node scripts/validate-content.cjs ai_democracy_2026
```

Si pasa sin errores, esta buena para usar.

---

## Como agregar escenarios

Edita `scenarios.json` en la carpeta de la sesion. Cada escenario es un
objeto en el array. Campos obligatorios:

```json
{
  "id": "u02_populismo_r1_concentracion",
  "order": 1,
  "title": "Concentracion en pocas empresas",
  "category": "Amenazas",
  "difficulty": "medium",
  "ranked": true,
  "durationSeconds": 240,
  "requiredTags": ["ASIMETRIA_DE_PODER", "RIESGO_DE_CAPTURA"],
  "judgeFocus": "Frase corta que dice al juez que priorizar en esta ronda.",
  "context": "Vineta concreta. Caso, decision en juego, actor con potestad, plazo.",
  "question": "Pregunta con tags entre corchetes. Maximo 12 lineas.",
  "conceptTags": ["concentracion_de_poder"],
  "referenceAnswer": "Una respuesta de referencia que ejemplifica nivel ~80.",
  "idealAnswer": {
    "keyPoints": ["..."],
    "expectedConcepts": ["..."],
    "commonMistakes": ["..."],
    "excellentResponseIndicators": ["..."]
  }
}
```

Convenciones:

- **`id`**: prefijo `u{N}` + topic + `r{N}`. Debe ser unico dentro de la
  sesion (el validador lo verifica).
- **`ranked: true`**: cuenta para el ranking. `false` = ronda diagnostica
  que no afecta el ranking pero extrae senales del estudiante.
- **`durationSeconds`**: opcional. Si esta, sobrescribe la duracion por
  ronda del config. Util para mezclar rondas largas y cortas.
- **`requiredTags`**: lista de tags forzados (sin corchetes en el array;
  con corchetes en el `question`). Estan documentados en
  `_shared/tag_vocabulary.md`.
- **`judgeFocus`**: ancla de prioridad para el juez en esta ronda. El
  motor lo inyecta directamente al prompt. Mantenlo corto y operacional.
- **`referenceAnswer`**: el motor usa esto para calibrar el juez sobre
  *cuanto detalle es esperable*. Sin esto, los jueces tienden a penalizar
  brevedad.
- **`idealAnswer`**: estructura mas detallada. El campo `commonMistakes`
  es especialmente importante: si lo dejas vago, el juez no detecta
  errores tipicos.

---

## Como definir tags obligatorios por escenario

1. Abrir `_shared/tag_vocabulary.md` y revisar que tags ya existen.
2. En el escenario, declarar `requiredTags: ["ACTOR_AFECTADO", ...]`.
3. En el campo `question`, escribir literalmente los tags entre corchetes
   con la pregunta especifica que cada tag debe responder. El estudiante
   ve la pregunta exactamente como tu la escribes.
4. La rubrica del curso ya penaliza la ausencia de tags solicitados via
   la `globalPenalty` "Tags solicitados ausentes" — no necesitas escribir
   nada extra.

Si necesitas un tag nuevo:
- Agregalo a `_shared/tag_vocabulary.md` con descripcion + ejemplos.
- Usalo en los escenarios donde aplique. No es necesario actualizar el
  motor — los tags son convencion textual, no codigo.

---

## Como modificar la rubrica

### Cambios pequeños (ajustar pesos, modificar un nivel)

Edita el `rubric.json` de la sesion especifica. Los pesos de las 3
dimensiones deben sumar 1.0 (el validador lo verifica).

### Cambios estructurales (renombrar dimensiones, cambiar IDs)

**No cambies los IDs de las dimensiones (`process_structuring`,
`institutional_realism`, `precision_clarity`).** Estan hardcoded en las
formulas de jueces en `functions/src/index.ts`. Los nombres en el campo
`name` y las descripciones SI puedes cambiarlas libremente — el juez ve
los nombres, no los IDs.

Si quieres redefinir las dimensiones por completo, hay que actualizar
las formulas en `functions/src/index.ts:148-152` y redeployar las
funciones (ver `CLAUDE.md` para el deploy desde WSL).

### Cambiar la rubrica base para todas las unidades

Edita `_shared/base_rubric.json`. Esto NO se aplica automaticamente — es
una plantilla. Para que el cambio surta efecto en una unidad, hay que
copiar manualmente al `rubric.json` de cada unidad. La razon es que
algunas unidades pueden querer ajustes locales (ej: la unidad 6 sobre
regulacion puede pesar mas la dimension institucional).

---

## Como modificar penalizaciones globales

Las penalizaciones viven en cada `rubric.json` bajo la clave
`globalPenalties` (lista de strings) y `softPenalties` (opcional).

Cada penalizacion tiene este formato:

> "Solucionismo tecnologico: si el estudiante propone una herramienta
> de IA como si por si sola resolviera un problema politico, ..., **no
> puede superar 60 en X dimension**."

La parte clave es la consecuencia explicita: "no puede superar 60 en X"
o "baja Y puntos en Z". El juez LLM lee esto literalmente.

Para penalizaciones reusables en todo el curso, mantenelas en
`_shared/global_penalties.json`. Para activarlas en una sesion, copia
las que apliquen al `rubric.json.globalPenalties` de esa sesion.

---

## Como probar localmente que el pack carga

### 1. Validar archivos

```bash
node scripts/validate-content.cjs ai_democracy_2026
```

Sale con codigo 0 si todo OK. Imprime errores accionables si algo falta
o esta mal.

### 2. Levantar el frontend

```bash
npm run dev
```

Abre la URL que imprime (tipicamente `http://localhost:5173`). Login
como profesor (Google) y crea un juego — la sesion **"Demo: IA y
Democracia (sesion de prueba)"** aparece en el listado bajo el grupo
"IA y Democracia".

### 3. Crear y jugar el demo

1. Selecciona "Demo: IA y Democracia" → "Crear Juego"
2. Comparte el codigo con (al menos) tu propia cuenta de estudiante
3. Une al menos un estudiante (puede ser tu otro navegador)
4. Inicia las 3 rondas:
   - R1: deepfake electoral (rankeada)
   - R2: chatbot de servicio publico (rankeada)
   - R3: perfil del estudiante (diagnostica, no rankeada)
5. Verifica que los 3 jueces (Dra. Demos, Abg. Garcia, Profe Naim AyD)
   evaluan correctamente y que las penalizaciones funcionan.

**Nota importante**: las funciones cloud que evaluan con OpenAI ya estan
desplegadas (compartidas con ML2). El juez consume `OPENAI_API_KEY` que
ya esta configurada. No tienes que redesplegar nada para probar AyD.

### 4. Si hay que actualizar los jueces en Firestore

Si modificaste `content/judges/default_judges.json` (ej: ajustaste la
personalidad de un juez), corre:

```bash
node scripts/seed-firestore.js
```

Esto sube el archivo a Firestore. Solo necesario si cambias
**personalidad / promptTemplate** de un juez. Los pesos por sesion
viven en cada `config.json` y no requieren seed.

---

## Que archivos NO toques si solo quieres agregar contenido

Lista de zonas reservadas al motor. Si las modificas, puedes romper el
juego para AyD **y** para ML2:

- `src/` — todo el frontend.
- `functions/src/` — toda la logica de evaluacion LLM.
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`.
- `package.json`, `package-lock.json`.
- `vite.config.ts`, `tsconfig.*`.
- `content/judges/default_judges.json` — los **3 jueces de ML2**
  (technical_expert, public_sector, professor_twin). Tocar los 3 nuevos
  de AyD (democracy_scholar, policy_lawyer, professor_twin_ayd) si.

Si necesitas cambiar algo del motor, abre el cambio con un comentario
explicito y verifica que ML2 sigue funcionando.

---

## Convenciones de nombres

### Carpetas de unidad
Formato: `unidad_{NN}_{slug_corto}` con `{NN}` de 2 digitos en orden y
`slug_corto` en snake_case sin acentos. Ejemplos:

- `unidad_01_backlash`
- `unidad_02_populismo_ia`
- `unidad_05_democracia_deliberativa`

### IDs de escenario
Formato: `u{N}_{topic}_r{N}` o variante reconocible. Ejemplos:

- `u02_populismo_r1_concentracion`
- `u05_deliberativa_r2_asambleas`
- `u00_demo_r1_deepfake_electoral`

Tienen que ser unicos dentro de la sesion. El validador lo verifica.

### IDs de dimension de rubrica
**No inventar nuevos.** Mantener `process_structuring`,
`institutional_realism`, `precision_clarity` (estan hardcoded en las
formulas de jueces). El campo `name` (visible) si lo cambias.

### Tags forzados
Mayusculas, sin acentos en el codigo del tag. Ejemplo: `[ACTOR_AFECTADO]`,
no `[ACTOR_AFECTÁDO]`. Esto evita problemas de encoding en el LLM.

### IDs de juez
Snake_case. Para AyD: `democracy_scholar`, `policy_lawyer`,
`professor_twin_ayd`. Si agregas un nuevo juez, agregalo tambien al
`defaultWeights` de `default_judges.json` y considera agregar una
formula en `functions/src/index.ts:148-152` (sino, fallback a "weighted
average").

---

## Que queda pendiente (TODO)

### Unidades 01-06: contenido real
Cada unidad tiene 1 escenario placeholder marcado `[PLACEHOLDER]`. Hay
que reemplazarlo por:

- 2-3 escenarios rankeados con dilemas concretos del topic
- (Opcional) 1 ronda diagnostica no rankeada
- Ajustar `roundCount`, `date`, `conceptTags` finales en `config.json`
- Ajustar `sessionLens` por juez en `judgeConfig` (idealmente despues
  de definir los escenarios — el sessionLens debe mencionar que mira
  cada juez en esa ronda especifica)
- Completar `knowledge_base.md` con conceptos clave + ejemplos

### Calibracion del juez LLM
Antes de usar una unidad en clase, conviene:

1. Escribir 3 respuestas sinteticas: una buena, una regular, una
   solucionista/vaga.
2. Crear un juego de prueba con esa unidad, jugar las 3 respuestas,
   ver los scores y feedback.
3. Si el juez es muy laxo o muy duro: ajustar `judgeFocus` del
   escenario y/o las penalizaciones globales.
4. Iterar 2-3 veces. La rubrica del demo (unidad_00_demo) ya esta
   calibrada minimamente, las unidades 01-06 no.

### Documentos de referencia (lecturas)
Si los estudiantes deben leer textos especificos antes de cada clase
(papers, capitulos), agrega un subdirectorio `reference_docs/` dentro
de la unidad y mete archivos `.md` con extractos relevantes. El motor
los carga automaticamente. Por ahora el demo y los placeholders no usan
reference docs — la KB integrada es suficiente.

### Roster de estudiantes
`content/courses/ai_democracy_2026/enrolled.json` esta vacio. Llenar
antes de la primera clase con `email`, `name`, `enrolledAt`.

### Decision pendiente: tags exotericos
Si quieres que algun tag adicional emerja del contenido del curso (ej:
`[ACTOR_NO_HUMANO]` para sistemas autonomos, `[INVERSION_DE_LA_CARGA]`
para regulacion proactiva), agregarlo a `_shared/tag_vocabulary.md`.

---

## Riesgos conocidos

1. **Calibracion fragil del juez LLM**. Los criterios "legitimidad vs
   legalidad" y "accountability decorativa" son interpretativos y el
   modelo puede fallar. Calibrar con casos sinteticos.
2. **Componente competitivo y materia deliberativa**. El curso enfatiza
   pluralismo y deliberacion; el juego es un ranking. La unidad 00 demo
   incluye una ronda no-rankeada como contrapeso. Para las unidades 01-06,
   considerar al menos una ronda diagnostica no-rankeada por unidad,
   especialmente en la unidad 5 (democracia deliberativa).
3. **Sesgo del LLM en juicios politicos**. GPT-4o tiene sesgos sobre
   temas como vigilancia, regulacion tecnologica, populismo. Las
   personalidades de los jueces (`democracy_scholar`, `policy_lawyer`)
   intentan equilibrar pero no eliminan el sesgo. Revisar feedback de
   estudiantes despues de cada clase.
4. **Dependencia de Firestore + OpenAI**. Si la API de OpenAI falla,
   el juez devuelve score neutral 50. Hay que tener un plan B si se
   quiere correr la clase offline.

---

## Comandos de cabecera

```bash
# Validar contenido (lo mas usado)
node scripts/validate-content.cjs ai_democracy_2026

# Validar todos los packs
node scripts/validate-content.cjs

# Levantar frontend en local
npm run dev

# Re-generar placeholders de unidades borradas
node scripts/scaffold-ai-democracy-units.cjs

# Subir jueces a Firestore (despues de editar default_judges.json)
node scripts/seed-firestore.js

# Build de produccion
npm run build
```

Deploy de funciones: ver `CLAUDE.md` (truco WSL).

---

## Contacto / dudas

Si algo del schema te bloquea, lo mas rapido es:

1. Mirar `unidad_00_demo` como ejemplo funcional completo.
2. Correr el validador y leer los errores.
3. Pedirle a Claude Code que te ayude — el repo tiene `CLAUDE.md` y
   este documento como contexto.
