# Qué dice la literatura sobre nuestro sistema de puntuación

Revisión de papers de *automated grading* / LLM-as-a-judge, y qué implican concretamente para el
motor de evaluación de Aula Maestra. Los cuatro primeros se leyeron el 2026-07-14 y tratan del
**juez** (puntaje absoluto contra rúbrica); el quinto se leyó el 2026-07-27 y trata de los
**duelos** (comparación de a pares + Bradley-Terry).

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
| 5 | **LCES** — Shibata & Miyamura, EMNLP 2025 main (2025.emnlp-main.1523) | Corrección zero-shot vía **comparación de a pares** en vez de nota absoluta: duelos con corrección de sesgo de posición → puntaje latente con RankNet → conversión lineal a la escala de la rúbrica. Datasets: ASAP (12.978 ensayos) y TOEFL11 (12.100). | **Alta, y es el único que habla de nuestros duelos.** 5 modelos × 8 prompts × 2 datasets, con ablaciones de sesgo de posición y de método de agregación. |

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

## Paper #5: LCES y nuestros duelos (leído 2026-07-27)

Los cuatro primeros papers hablan del **juez**. LCES habla de la otra mitad del motor: los duelos
de a pares que corre `recalibrateRound`. Su tesis es la que nosotros ya asumimos cuando
construimos la recalibración — un LLM es mejor decidiendo *"¿cuál de estas dos es mejor?"* que
poniendo una nota absoluta contra una rúbrica. Su aporte para nosotros no es la tesis, es la
**higiene**: qué hay que hacer para que los duelos no midan otra cosa.

Su pipeline tiene tres pasos. Adoptamos el primero, descartamos el tercero, y el segundo nunca
estuvo en discusión.

### Lo que medimos antes de decidir

`scripts/bt-order-flip.ts` (nuevo) reusa los ~2.000 veredictos ya cacheados en
`scripts/.cache/pairwise-*.jsonl` y corre **sólo el orden invertido** — la mitad forward sale
gratis porque la clave del caché incluye el orden de presentación. 200 pares, gpt-4o a
temperatura 0, $0,47:

| Métrica | Valor |
|---|---|
| Los dos órdenes deciden y coinciden | 86,5% |
| **Se contradicen (flip)** | **13,5% ± 2,4pp** |
| Latencia por llamada | mediana 612 ms · p90 1.127 ms |
| Costo por llamada | $0,0024 |

Cae dentro del rango que LCES §5.2 reporta para gpt-4o (10,4% ASAP / 17,0% TOEFL11): el número
ajeno transfiere. **El sesgo tiene dirección** — 21 de los 27 flips (78%) favorecen a la *segunda*
respuesta, lo que concuerda con el `firstWinRate` de 0,458 promediado sobre las 16 rondas de
`bt-pairwise-report.html`. No es ruido simétrico.

Y el flip se concentra donde el reordenamiento ocurre: **27,9% con Δ<5**, 12,8% con Δ5-15, ~6% de
ahí en adelante. Como el schedule Swiss empareja **por cercanía de puntaje, a propósito**, casi
todos los duelos de producción caen en las bandas ruidosas. El schedule está optimizado para el
drama y eso lo mete de lleno en el régimen malo: efecto del diseño, no accidente.

**La medición directa, sobre los pares del propio schedule Swiss: 31,8% ± 1,2pp** (1.455 pares,
cacheados al correr `bt-calibrate.ts` con doble orden). Primero proyectamos 21,2% reponderando las
tasas por banda; la proyección se quedó corta porque el Swiss no reparte parejo dentro de la banda
Δ<5, concentra en los pares aún más apretados. Y 31,8% es **piso**: el barrido samplea bandas 1-5
y producción usa 1-4, y las bandas anchas flipean menos.

**Uno de cada tres duelos lo decidía la posición y no la calidad.**

### 1. Doble orden — ADOPTADO

El comentario de `pairwise.ts:23` dice que el hash djb2 "cancela" el sesgo de posición. **Es
falso.** Como `swissPairs` devuelve `[mejor, peor]` y el hash no está correlacionado con la
fuerza, sí logra que el sesgo no favorezca a punteros ni a colistas — eso vale. Pero lo convierte
en **ruido por duelo**, y el ruido atenúa: aplana las fuerzas BT y vuelve aleatorios los
reordenamientos específicos. Lo reparte; no lo detecta ni lo elimina.

LCES consulta cada par en los dos órdenes y, si se contradicen, lo cuenta como empate. **El costo
que uno esperaría no existe:** el LLM tarda ~6 s en una ronda mediana (21 alumnos, 75 duelos) y el
montaje del reveal necesita ~40 s, así que hoy el LLM termina con 34 s de holgura y al doblar con
28 s. No se nota. Plata: +$0,18 por ronda.

Diseño en `docs/superpowers/specs/2026-07-27-doble-orden-duelos-design.md`. **Desplegado el
2026-07-27** y verificado en vivo (ver "Estado de implementación").

Efecto lateral que hubo que atender en el mismo cambio: **`RecalibrationReveal.tsx` no sabía dibujar
un empate** (`:135` sólo pinta el cartel del ganador, y en `:113-120` los dos paneles quedan en
`lose` si nadie ganó). Hoy no se nota porque el único empate posible es un error de API; con el
doble orden sería 1 de cada 5 tarjetas viéndose como si el juego se hubiera roto.

### 2. Empates explícitos en el prompt — DESCARTADO

`buildComparePrompt` dice *"no empates salvo que sean indistinguibles"* y el formato que documenta
sólo ofrece `{"winner":"A"}` o `{"winner":"B"}`. O sea: el tipo `Comparator` y `DuelResult.winner
= -1` soportan empate de punta a punta, y el prompt lo desactiva.

Se descartó igual. La regla de LCES ya captura los pares genuinamente parejos por la vía dura, y
su tasa de empate queda **acotada por la de flip medida**. Ofrecerle la salida fácil al modelo
tiene tasa de empate no acotada, y si abusa de ella la recalibración se apaga.

Sobre el miedo a que los empates aplanen el ranking: **la escala no puede aplanarse**, porque
`recalibration.ts:77` pasa por `linearMatchMoments`, que reimpone media y desviación de los
provisionales pase lo que pase. Lo que los empates diluyen es el *poder de reordenar*: con n=21 y
B=4 los duelos frescos son hoy el 50,2% de la masa direccional (74 duelos a peso 1 contra 210
pares de ancla × 0,35), y con 21% de empates bajan a 44,3%. **Pero ese 21% ya era basura** — sus
reordenamientos eran aleatorios. Predicción falsable: el `avgMove` de `bt-calibrate.ts` baja y su
`stability` split-half sube.

**Se cumplió, en las 12 celdas del barrido, sin excepción.** Para `B=4` (producción usa
`w_anchor=0,35`, entre las dos celdas vecinas de la grilla):

| B=4 | avg\|Δrank\| | %moved | stability |
|---|---|---|---|
| w=0,50 | 2,047 → 1,900 | 0,788 → 0,791 | 0,957 → **0,969** |
| w=0,25 | 3,044 → 3,015 | 0,847 → 0,850 | 0,884 → **0,915** |

**No hubo que mover ninguna constante.** El patrón fino importa: `%moved` queda plano y `avgMove`
baja un poco, o sea que se mueve la misma gente pero salta menos lejos. Con la estabilidad al alza,
la lectura es que sacamos los saltos largos aleatorios —las sorpresas que eran cara o sello— y
conservamos el reordenamiento real. **Un upset falso es peor que ningún upset.**

### 3. RankNet — DESCARTADO

RankNet es una red chica que lee el **embedding del texto** y devuelve un número; se entrena con
pares etiquetados y aprende texto → puntaje. Bradley-Terry no lee nada: un parámetro libre por
ítem, ajustado contra el registro de victorias. El paper atribuye su ganancia justamente a eso, y
tiene razón — pero es un artefacto de su régimen, que es el opuesto al nuestro.

1.700 ensayos con 5.000 comparaciones son **~3 comparaciones por ítem**: la mayoría queda casi sin
restringir y BT no tiene con qué ubicarlos; RankNet los rescata **interpolando** desde el
embedding. La figura 4 con M=50 son **0,03 comparaciones por ítem**, donde BT ni siquiera puede
rankear al 95% del conjunto. Que RankNet gane con 50-100 comparaciones es cierto y **no es nuestra
situación**: nosotros hacemos `(4n−10)×2/n ≈ 7 duelos por estudiante`, cada ítem está densamente
comparado, el grafo es conexo por construcción y el BT queda completamente determinado. No hay
ítems huérfanos que rescatar, que es lo único que RankNet aporta.

Acá además haría daño: ~800k parámetros sobre 21 ítems y 74 etiquetas binarias es sobreajuste
garantizado; de embeddings de respuestas de alumnos aprendería longitud, tema y estilo —
exactamente los atajos que no queremos premiar— sin conjunto de validación para pillarlo; y
metería una llamada de embeddings por respuesta, un loop de entrenamiento dentro de una Cloud
Function sin torch, e inicialización aleatoria en un ajuste que hoy es reproducible.

### Lo que LCES admite y nos aplica

Su sección *Limitations* dice tres cosas que son nuestras también:

- Las etiquetas de preferencia son ruidosas y ese ruido pasa directo al puntaje. Es el mismo
  problema que el doble orden ataca.
- **No saben cómo elegir M** (cuántas comparaciones). Nosotros sí tenemos una respuesta empírica:
  `bt-calibrate.ts` barre B y w_anchor contra estabilidad split-half. Vamos adelante en esto.
- La conversión lineal a la escala de la rúbrica asume que las comparaciones cubren todo el rango.
  Nosotros hacemos lo mismo (`linearMatchMoments`) y ya nos mordió una vez: el clamp a [0,100] de
  `recalibration.ts:79` existe porque el juego UVMJW3 ronda 5 le mandó un −2 a un alumno.



El aporte central de Grade-Like-a-Human es la etapa de **post-grading review**: agrupar todos los
scores, hacer que un LLM detecte los inconsistentes, y re-corregirlos. Subió la detección de
anomalías de 0.58 → 0.76 con re-grouping.

**Nuestro `recalibrateRound` (Bradley-Terry sobre duelos pairwise) es una versión estrictamente más
fuerte de esa idea**: comparaciones pairwise reales en vez de un LLM mirando una lista de números,
ajustadas con un modelo estadístico principiado y ancladas para que no se disparen. Nada en esos
cuatro papers es tan sofisticado como lo que ya está deployado.

**La excepción es LCES (#5)**, que sí trabaja en esta capa y va más allá en un punto concreto: la
corrección de sesgo de posición, que nosotros creíamos tener resuelta con un hash y no lo estaba.
Ese sí lo adoptamos. Su otra pieza (RankNet) es el caso contrario — nos gana en un régimen que no
es el nuestro. Ver la sección del paper #5 arriba.

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

**Hecho (2026-07-27) — doble orden en los duelos (LCES #5), DESPLEGADO:**
- `pairwise.ts` consulta cada par en los dos órdenes y trata la contradicción como empate. El hash
  `djb2` se borró: repartía el sesgo en vez de eliminarlo.
- `RecalibrationReveal.tsx` aprendió a dibujar un empate. Antes lo pintaba como dos paneles
  apagados, sin texto, 160 ms — porque el único empate posible era un error de API. Con el doble
  orden habría sido 1 de cada 3 tarjetas.
- `RECAL_B` / `RECAL_W_ANCHOR` **no se tocaron**: el barrido mostró que el drama aguanta y la
  estabilidad sube. Diseño en `docs/superpowers/specs/2026-07-27-doble-orden-duelos-design.md`.
- **Verificación en vivo (juego `4GRBDT`, 3 rondas ranked):** los empates se producen en producción
  y **no vienen de fallos de API** — cero `compare error` en los logs de `recalibrateRound`, así
  que el empate observado es un veredicto que efectivamente se dio vuelta al invertir el orden.
  Naim confirmó que se ve como el sello "EMPATE" y no como dos paneles apagados. Recalibración
  completa en 1,5-2,1 s por ronda, consistente con los ~600 ms por llamada medidos offline.
- **Lo que esa partida NO prueba:** la tasa del 31,8%. Fue con 2 cuentas, o sea 1 duelo por ronda:
  1 empate de 3 duelos. El intervalo de confianza de 1/3 va de 0,8% a 91%. La tasa en vivo se
  medirá sola la próxima vez que juegue un curso de ~20, donde una ronda genera ~70 duelos.

**Hallazgo lateral, ya arreglado:** `bt-calibrate.ts` y `bt-pairwise.ts` estaban rotos en `HEAD` y
no arrancaban. `scripts/lib/bradley-terry.ts` era una copia de la de `functions/src/lib/` que se
quedó atrás en un refactor y no exportaba `fitBradleyTerryFromWins`. Ahora es un reenvío, que no se
puede desincronizar. **Lección:** verificar que una herramienta de análisis *existe y hace lo que
dice* no es lo mismo que verificar que *corre*. Dos de las tres estaban muertas y ningún test lo
decía, porque los scripts de `scripts/` no los cubre ninguna suite.

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
