# Qué dice la literatura sobre nuestro sistema de puntuación

Revisión de cuatro papers de *automated grading* / LLM-as-a-judge, leídos el 2026-07-14, y qué
implican concretamente para el motor de evaluación de Aula Maestra.

Los PDFs están en `literatura/evaluacion_llm/` (ignorado por git — son copyrighted). Este
documento es el registro persistente: si los PDFs desaparecen, lo que aprendimos sobrevive acá.

---

## Los papers

| # | Paper | Qué es | Peso de la evidencia |
|---|---|---|---|
| 1 | **Grade Like a Human** — Xie, Niu, Xue, Guan (arXiv 2405.19694) | Sistema multi-agente de corrección: generación de rúbrica a partir de respuestas reales, estrategias de prompt, y una etapa de *post-grading review*. Datasets: OS (propio, 6 preguntas × 40 alumnos, 3 TAs c/u) y Mohler. | **Alta.** El más relevante de los cuatro. Ablaciones reales contra notas humanas. |
| 2 | **Beyond Human Subjectivity and Error** — Gobrecht et al., IU International University (arXiv 2405.04323) | Modelo ASAG fine-tuneado, comparado contra correctores humanos certificados sobre 1600 respuestas de exámenes reales con nota oficial vinculante. | **Alta.** El único con ground truth de alto riesgo y benchmark humano. |
| 3 | **Automated grading workflows / `gradetools`** — Ricci, Medina, Dogucu (arXiv 2309.12924) | Paquete de R para corrección humana asistida: ítems de rúbrica ligados a feedback reutilizable, edición dinámica de rúbrica. Sin LLM. | **Media.** Aporte conceptual, no empírico. |
| 4 | **GRAD-AI** — Gambo et al., Educ Inf Technol 30:9859 | Herramienta de corrección de código (AST + Halstead + TF-IDF + k-means). | **Baja.** Su única validación es una encuesta de satisfacción (85% "satisfecho con la justicia del sistema"). Sin ground truth. |

---

## Los cinco hallazgos que nos aplican

### 1. Pedir el score primero es un error estructural, no cosmético

Nuestro judge devuelve `{"score": 87, "feedback": ...}` — el número es el **primer token**, generado
antes de que exista una sola palabra de análisis en el contexto. Un LLM genera de izquierda a
derecha: el score queda condicionado únicamente al prompt, y todo lo que viene después
(`feedback`, `strengths`) se genera condicionado *a ese número*, o sea que lo racionaliza en vez de
derivarlo.

Grade-Like-a-Human hace lo contrario: su prompt termina en *"Let's think step by step"* y el formato
de salida es `[explanation]` → `[score]`.

Esto pega **más fuerte** en gpt-4o que en un modelo de razonamiento: un reasoning model piensa en
tokens ocultos antes de emitir nada, gpt-4o no tiene ese escape — **su output visible es su único
espacio de razonamiento**. El orden de los campos del JSON *es* el presupuesto de razonamiento.

**Orden propuesto:** `analysis` → `penaltiesApplied` → `dimensionScores` → `strengths` →
`improvements` → `feedback`. El campo `score` desaparece (ver #2).

### 2. La aritmética y los topes deben estar en código, no en el prompt

Hoy le pasamos al modelo el string `score = 0.55 * process_structuring + 0.20 * institutional_realism
+ 0.25 * precision_clarity` y leemos `response.score` — un número que gpt-4o calculó *de cabeza,
en medio de la generación*, y que nunca contrastamos contra los `dimensionScores` que también
reportó.

Lo mismo con los ocho topes duros de `globalPenalties` (`base_rubric.json:49-58`, del tipo *"no puede
superar 60 en Mapeo de Actores"*). **No existe lógica de topes en el código.** No hay ningún
`Math.min(score, 60)` en el repo. Pegamos ocho reglas condicionales en un prompt y confiamos en que
el modelo las aplique de forma consistente, a `temperature: 0.5`, mientras además hace aritmética
ponderada de tres términos, en español, en un solo forward pass, antes de haber escrito una palabra
de análisis.

**Solución:** el juez devuelve sólo `dimensionScores` + una lista de qué penalizaciones observó
(eso es *juicio*, que es lo que sabe hacer). TypeScript hace la suma ponderada y aplica los
`Math.min` (eso es *aritmética*, que es lo que sabe hacer el código). Beneficio secundario: el score
pasa a ser auditable — se le puede mostrar a un alumno exactamente por qué sacó 71.

### 3. La escala 0–100 continua es más fina que la señal

Beyond Human Subjectivity encontró que el error de corrección **crece monotónicamente con la
granularidad de la escala**: MAE normalizado de 0.149 en preguntas de 6 puntos → **0.251 en preguntas
de 18 puntos**.

Nuestra `base_rubric.json` ya declara `scaleLevels: [100, 80, 60, 40, 20, 0]` y define un párrafo de
ancla en prosa para cada nivel (`level_100` … `level_0`) — pero el schema del prompt pide
`<numero 0-100>`, o sea que pedimos una precisión para la que la rúbrica no tiene anclas.

**Solución:** pedir **un ancla de seis niveles por dimensión**, nunca un número libre y nunca un
agregado. Así la tarea del juez pasa de "produzca un número" (regresión) a "¿cuál de estos seis
párrafos describe mejor esta respuesta?" (clasificación con definición escrita para cada opción) —
mucho más repetible. El 0–100 final sigue existiendo: sale de la suma ponderada en código.

### 4. Rúbricas muy restrictivas *empeoran* las preguntas conceptuales

El hallazgo más contraintuitivo de Grade-Like-a-Human. Corrieron la misma rúbrica en dos
granularidades sobre dos datasets y obtuvieron resultados **opuestos**:

- **Dataset OS** (preguntas complejas, multi-paso, con ejecución de código): la rúbrica fine-grained
  **mejoró** el score.
- **Dataset Mohler** (preguntas conceptuales abiertas, tipo *"¿cuál es el rol de un programa
  prototipo en la resolución de problemas?"*): la rúbrica fine-grained **empeoró** el score.

Su explicación: en preguntas conceptuales el world knowledge del LLM ya alcanza para evaluar bien, y
*"not overly constraining the LLMs can better leverage their abilities"*.

**Nuestras rondas son forma-Mohler, no forma-OS** ("nombra la tensión democrática en juego"). Esto es
evidencia directa de que nuestros **ocho topes duros pueden estar costando precisión en vez de
comprar justicia**. Nuestro propio `docs/game_design_log.md:98` ya dice *"no usar más de 3 hard
penalties por sesión; si todo es grave, nada es grave"* — y `base_rubric.json:3`
(`_calibration_warning`) admite que el juez patina justo en la frontera 60/80 y en distinguir
accountability real de decorativa, que es exactamente sobre lo que giran cuatro de los ocho topes.

**Acción:** medir cuáles topes realmente se disparan alguna vez, y bajar de 8 a ≤3.

### 5. Ninguno de los cuatro papers valida sin ground truth. Nosotros sí.

Los cuatro se validan contra notas humanas (Mohler, notas oficiales de examen, notas de TAs).
Nosotros **nunca hemos comparado un score del juez contra un score puesto por Naim.**

`scripts/bt-calibrate.ts` mide **estabilidad split-half** (ρ≈0.88–0.98), que **no es exactitud**: tres
personas del mismo modelo pueden coincidir perfectamente y estar uniformemente equivocadas. Y como
son el mismo modelo, sus errores están correlacionados por construcción.

**La buena noticia: la vara es baja.** En Beyond Human Subjectivity, correctores humanos
*certificados* recorrigiendo exámenes reales alcanzaron:

| Comparación | Pearson | Desviación absoluta mediana |
|---|---|---|
| Humano vs. nota oficial | **0.485** | **20 puntos porcentuales** |
| Modelo vs. nota oficial | 0.590 | 11 puntos porcentuales |

O sea: el acuerdo humano-humano en corrección de respuestas abiertas es *malo*. Si hand-scoreamos 30–40
respuestas y el juez correlaciona a ρ≈0.6, **ya estamos en el techo humano** y seguir puliendo la
rúbrica es perseguir ruido.

---

## Lo que la literatura NO cambia (dónde vamos adelante)

El aporte central de Grade-Like-a-Human es la etapa de **post-grading review**: agrupar todos los
scores, hacer que un LLM detecte los inconsistentes, y re-corregirlos. Subió la detección de
anomalías de 0.58 → 0.76 con re-grouping.

**Nuestro `recalibrateRound` (Bradley-Terry sobre duelos pairwise) es una versión estrictamente más
fuerte de esa idea**: comparaciones pairwise reales en vez de un LLM mirando una lista de números,
ajustadas con un modelo estadístico principiado y ancladas para que no se disparen. Nada en estos
cuatro papers es tan sofisticado como lo que ya está deployado.

Su **batching prompt** (corregir N alumnos en una sola llamada para que el modelo los tenga lado a
lado) es la aproximación barata de lo que nuestros duelos ya hacen bien. **No adoptarlo.**

De `gradetools` vale la pena rescatar una idea: **ítems de rúbrica ligados a texto de feedback
reutilizable**, para que el mismo error produzca el mismo feedback en todos los alumnos. Hoy cada
feedback se genera de cero.

De GRAD-AI, sólo su limitación declarada: *"the AI techniques used for grading may not align
perfectly with the course's learning objectives"* — validez de constructo. Vale como recordatorio,
no como evidencia.

---

## Sobre el ground truth sintético

Pregunta abierta que resolvimos así: **una respuesta generada por LLM no puede ser ground truth**.
Si GPT escribe la respuesta de referencia y GPT corrige contra ella, medimos la auto-consistencia de
GPT — que ya sabemos que es alta. No dice nada sobre si los scores siguen *el juicio del profesor*,
que es lo único que importa.

Pero hay un camino intermedio, y es el que la propia rúbrica ya pide (`_calibration_warning`:
*"Calibrar con 3-4 respuestas sintéticas por unidad antes de usar en clase"*):

1. Un LLM escribe respuestas sintéticas **apuntando a cada ancla** — una deliberadamente nivel 100,
   una nivel 80, una 60, una 40, más una que dispare cada penalización.
2. **Naim sólo verifica la etiqueta**, que toma segundos por respuesta en vez de minutos ("sí, eso es
   un 80"; "no, eso es un 60 en realidad").
3. Ahora existe un set etiquetado cuyas **etiquetas son suyas**, y se puede medir si los jueces las
   recuperan.

Si el juez no distingue un 60 deliberado de un 80 deliberado, ninguna cantidad de prosa en la rúbrica
lo va a salvar. *El generador propone; el profesor dispone.*

---

## El nuevo contrato del juez (implementado 2026-07-14)

**El juez ya no emite un score.** Emite juicios; el motor hace la aritmética.

El JSON que devuelve, en este orden exacto:

```json
{
  "analysis": "<2-4 oraciones: qué dice realmente la respuesta, dimensión por dimensión>",
  "penaltiesApplied": ["solucionismo_tecnologico"],
  "dimensionScores": { "process_structuring": 60, "institutional_realism": 60, "precision_clarity": 100 },
  "strengths": [...], "improvements": [...],
  "feedback": "..."
}
```

- `analysis` **primero**: el modelo razona antes de puntuar, no después.
- `dimensionScores` sólo acepta **0 / 20 / 40 / 60 / 80 / 100** — las seis anclas que la rúbrica ya
  define en prosa. Cualquier valor fuera de ancla se *snapea* (`snapToAnchor`).
- **No hay campo `score`.** Lo calcula `functions/src/lib/scoring.ts`.
- `penaltiesApplied` son **ids**, no descuentos. Un id que no existe en la rúbrica se registra como
  `unknownPenalties` y se ignora — una penalización alucinada ya no mueve el puntaje en silencio.

`scoring.ts` hace: parsear el `weightFormula` de la sesión (que ya existía como prosa y ahora se
**ejecuta**), aplicar topes (`cap`) y descuentos (`deduct`), y la suma ponderada. Todo auditable:
`appliedPenalties` guarda `{id, dimension, from, to}` por cada penalización aplicada, así que un
puntaje se le puede explicar a un alumno línea por línea.

### Penalizaciones: tres formatos, dos modos

Las rúbricas del repo tenían **tres** formatos distintos de penalización. El motor los soporta todos,
en dos modos:

| Formato | Ejemplo | Modo |
|---|---|---|
| `penalties` estructurado (nuevo) | `{id, description, effect: {type:'cap', value:60, dimensions:[...]}}` | **Código** aplica el tope |
| Objeto `{condition, cap, dimension}` (sesiones RAG de ml2) | `{"condition": "Confunde indexacion...", "cap": 60, "dimension": "technical_pipeline"}` | **Código** — convertible directo |
| Prosa (`globalPenalties: ["Falsa precision: ... no puede superar 60 en ..."]`) | el tope vive dentro de una oración en español | **Juez** se auto-aplica (status quo) |

Ninguna sesión pierde sus topes: si la rúbrica no es migrable, el prompt le dice explícitamente al
juez que los aplique él mismo, como hasta ahora. Estado actual:

| Sesión | Topes |
|---|---|
| `ai_democracy_2026/*` (8 unidades) | **código**, 8/8 |
| `ml2-2025/session_3_rag`, `session_4_rag_applied` | **código**, 3/3 |
| `temas_emergentes_2026/*` | juez (8–14 penalizaciones en prosa) |
| `ml2-2025/session_1`, `session_2` | juez (4 y 7 en prosa) |

`temas_emergentes` quedó sin migrar a propósito: sus topes están en **70 y 75**, que no caen en la
grilla de seis anclas (un tope de 75 significa en la práctica "no puede llegar a 80", o sea colapsa a
60). Reinterpretar esos umbrales es una decisión pedagógica de Naim, no del motor.

## Estado de implementación

**Hecho (2026-07-14):**
- `temperature: 0.5` → `0` en el judge (la corrección no debería ser estocástica).
- **Contrato nuevo del juez** (arriba): `analysis` antes que los puntajes, 6 anclas por dimensión, sin
  campo `score`, penalizaciones por id. `functions/src/lib/scoring.ts` + 27 tests.
- Los 6 jueces de los 2 cursos (`content/courses/*/judges.json`) migrados al nuevo schema.
- Las 8 rúbricas de AyD migradas a `penalties` estructuradas.
- Bug: `response.score || 0` → `coerceScore()` + clamp 0–100. gpt-4o a veces devuelve `"60"` como
  string; `parse.ts` ya lo documentaba pero `evaluateWithJudge` no lo usaba.
- Bug: un juez que fallaba inyectaba un **50 neutral** silenciosamente en la media ponderada. Ahora
  se marca `failed` y se **excluye**; `totalWeight` renormaliza sobre los que sí respondieron.
- Bug: los pesos se buscaban por **índice posicional** en un array ya `.filter(Boolean)`-eado — si un
  juez faltaba en `config/judges`, todos los pesos siguientes se corrían al juez equivocado. Ahora se
  buscan por `judgeId`, en un helper `aggregateEvaluations()` compartido por los dos call sites.
- Bug (encontrado al migrar): un loader anterior filtraba sólo strings, lo que **descartaba en
  silencio todos los topes de las sesiones RAG** de ml2 (formato objeto). Cubierto por test.

⚠️ **Los promptTemplates viven en Firestore (`config/judges`), no en el repo en runtime.** Los cambios
a `content/courses/*/judges.json` NO tienen efecto hasta correr `node scripts/seed-firestore.cjs`.

### Panel multi-modelo (implementado 2026-07-15)

Los tres jueces ahora corren en **tres modelos distintos**, no tres personas de gpt-4o. Tres personas
del mismo modelo comparten training y tokenizer: cuando el modelo malinterpreta una respuesta, las
tres fallan igual, y promediar errores correlacionados fabrica un falso consenso. Modelos genuinamente
distintos decorrelacionan el error, y un desacuerdo fuerte entre ellos es en sí una señal (respuesta
borderline o rúbrica ambigua).

Mapeo aprobado (persona → proveedor), **misma banda de precio**:

| Curso | Persona | Proveedor | Modelo | Precio in/out $/MTok |
|---|---|---|---|---|
| AyD | `democracy_scholar` | OpenAI | `gpt-5` | $1.25 / $10 |
| AyD | `policy_lawyer` | Gemini | `gemini-2.5-pro` | $1.25 / $10 |
| AyD | `professor_twin_ayd` | Anthropic | `claude-sonnet-5` | $3 / $15 |
| ml2 | `technical_expert` | OpenAI | `gpt-5` | $1.25 / $10 |
| ml2 | `public_sector` | Gemini | `gemini-2.5-pro` | $1.25 / $10 |
| ml2 | `professor_twin` | Anthropic | `claude-sonnet-5` | $3 / $15 |

Output dentro de ~1.5x entre los tres — panel de tres modelos distintos y balanceados en costo, sin que
uno domine la cuenta. Evolución: v1 usó opus-4-8 $5/$25 + gemini-flash $0.30/$2.50 (spread 10x, mal);
se corrigió a la banda de gpt-4o el 2026-07-15; y luego gpt-4o → **gpt-5** (mismo output $10, input a la
mitad, y modelo frontier actual en vez de uno legacy — upgrade estricto por menos plata).

- `functions/src/lib/judgeModels.ts` (+18 tests): selección de proveedor/modelo, llamada por proveedor,
  extracción de JSON. `provider` y `model` son campos por-juez en `judges.json` (config gana sobre el
  mapeo por-judgeId en código). El score se sigue calculando en `scoring.ts` — el modelo sólo entrega
  anclas + penalizaciones.
- **Smoke test en vivo (2026-07-15):** los tres proveedores devuelven JSON válido; en la MISMA
  respuesta puntuaron una dimensión 80 / 40 / 80 (gpt-4o y Gemini de acuerdo, Opus más duro) — la
  diversidad del panel funcionando. Latencias 2-4s, en paralelo.
- Particularidades por proveedor (todas verificadas con probes en vivo, no de memoria):
  - **OpenAI gpt-5** (familia reasoning): rechaza `temperature` (solo default 1 → sin `temperature`),
    usa `max_completion_tokens` en vez de `max_tokens`, y **`reasoning_effort: 'minimal'`** — sin eso
    tarda ~8s; con minimal ~3-4s (banda gpt-4o) y sigue devolviendo JSON válido. `isOpenAIReasoningModel()`
    detecta gpt-5*/o-series; los modelos chat (gpt-4o) siguen el path viejo (temperature 0 + max_tokens).
    Consecuencia: el juez OpenAI **no es bit-reproducible** (temp 1 forzada); el snap a 6 anclas en
    scoring.ts absorbe casi toda esa varianza.
  - **Anthropic sonnet-5**: `system` top-level, **omite `temperature`** (sonnet-5/opus lo rechazan con 400).
  - **Gemini 2.5-pro**: `responseMimeType: application/json` y **`thinkingBudget: 128`**
    (`GEMINI_THINKING_BUDGET`) — su "thinking" oculto por defecto se come el presupuesto de tokens y trunca
    el JSON (bug encontrado en el smoke test); pro no permite 0, así que se fija en el mínimo.
- **Costo:** los tres modelos están en la misma banda (tabla arriba). Para mover todo el panel a una
  banda más barata, poner `"model"` por juez en `judges.json` (ej: `gpt-4o-mini` / `claude-haiku-4-5` /
  `gemini-2.5-flash`) — un cambio de config sin tocar código (con flash, `GEMINI_THINKING_BUDGET` puede
  bajar hacia 0). Los defaults viven en `DEFAULT_MODELS` (judgeModels.ts).
- Los duelos pairwise (`recalibrateRound`) y el AI-builder siguen en gpt-4o single-model — es correcto,
  no son el panel de jueces.

⚠️ **Falta desplegar:** los prompts + el campo `provider` viven en Firestore `config/judges`. Correr
`node scripts/seed-firestore.cjs` y desplegar functions (con los 3 secrets ya en Secret Manager) antes
de que surta efecto.

**Pendiente / propuesto:**
- **Post-grading review** (Grade-Like-a-Human): la *detección* ahora es casi gratis — con 3 modelos
  distintos, la dispersión entre jueces ya es la señal (ver el 80/40/80 del smoke test). El *re-grade*
  es 1 llamada extra sólo para los flagged, y cabe dentro de la ventana de los duelos. Costo ≈ 0.
- Bajar los topes duros de 8 a ≤3 — ahora **medible**: `appliedPenalties` deja registro de cuáles se
  gatillan de verdad.
- Migrar `temas_emergentes` y `ml2-2025 s1/s2` a `penalties` estructuradas (decidir los topes 70/75).
- **Ground truth**: el set sintético etiquetado por Naim, y medir MAE / Pearson contra los jueces.
  Con las respuestas ya guardadas en Firestore se puede re-puntuar juegos pasados con el prompt viejo
  y el nuevo, y **medir si los rankings viejos eran malos** en vez de suponerlo.
