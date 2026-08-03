# Game Design Log

Decisiones de diseno acumuladas. Los subagentes deben leer este archivo antes de proponer cambios.

---

## Decisiones Vigentes

### D1: evaluationGuide reemplaza idealAnswer (2026-03-19)

**Decision**: Cada escenario usa `evaluationGuide` con campos `must_hit`, `fatal_errors`, `partial_credit` (60/80/100), `nice_to_have` en vez del antiguo `idealAnswer`.

**Razon**: `idealAnswer` era sobre-prescriptivo. Los jueces lo usaban como solucionario unico, penalizando respuestas correctas pero formuladas distinto. El nuevo formato separa "que conceptos son obligatorios" de "como se ve una respuesta a cada nivel".

**Trade-off**: Los jueces tienen menos guia especifica, lo que puede producir mayor varianza. Mitigado con `partial_credit` que describe cada nivel.

**No revertir salvo si**: Se demuestra que la varianza entre jueces aumento significativamente sin beneficio en justicia de scoring.

---

### D2: Inyeccion dinamica de dimensiones y formulas (2026-03-19)

**Decision**: `evaluateWithJudge` lee dimension IDs de `rubric.json` y los inyecta en los templates via `{{dimensionScoresJson}}`, `{{weightFormula}}`, `{{sessionLens}}`, `{{evaluationGuide}}`.

**Razon**: Los templates de jueces estaban hardcodeados con nombres de dimensiones de sesion 1 (`process_structuring`, `institutional_realism`, `precision_clarity`). Al crear sesion 3 con dimensiones distintas (`technical_pipeline`, `institutional_criteria`, `clarity_critical_thinking`), habia desacople. La inyeccion dinamica permite que cada sesion tenga sus propias dimensiones sin tocar el backend.

**Trade-off**: Mas complejidad en `evaluateWithJudge`, y los templates son mas dificiles de leer aislados (tienen placeholders en vez de contenido).

**No revertir salvo si**: Se simplifica a un set unico de dimensiones para todas las sesiones.

---

### D3: 3 hardPenalties con cap, no 8 globalPenalties (2026-03-19)

**Decision**: Rubrica usa `hardPenalties` (cap en dimension especifica, maximo 3) + `softPenalties` (deduccion en puntos, maximo 6-8) en vez del antiguo array `globalPenalties` de strings.

**Razon**: Feedback del consultor: 8 penalidades no eran verificables por un LLM, algunas se solapaban, y no estaba claro cuales eran severas vs leves. La separacion en hard/soft con dimension especifica da instrucciones mas claras al juez IA.

**Trade-off**: El formato antiguo (`globalPenalties` + `penaltyIndicators`) sigue siendo parseado por backward compatibility. Sesiones 1 y 2 no fueron migradas.

**No revertir salvo si**: Se demuestra que los jueces IA no distinguen bien entre hard y soft penalties.

---

### D4: sessionLens en config.json (2026-03-19)

**Decision**: Cada sesion tiene un bloque `judgeConfig` en `config.json` con `sessionLens` y `weightFormula` por juez. Se inyecta via `{{sessionLens}}`.

**Razon**: Los jueces tienen personalidades genericas (escritas para sesion 1) pero cada sesion tiene vocabulario y conceptos distintos. El `sessionLens` le dice al juez "en ESTA sesion, tu obsesion es X" sin cambiar su personalidad base.

**Trade-off**: Mas contenido en cada prompt (tokens adicionales). Mitigado porque `sessionLens` es texto corto (~100 palabras por juez).

**No revertir salvo si**: Se unifican todas las sesiones en una misma ontologia de evaluacion.

---

### D5: Profe Naim cap 50 en vez de multiplicador 0.7 (2026-03-19)

**Decision**: Profe Naim aplica tope de 50 en la tercera dimension (claridad/pensamiento critico) cuando la respuesta es generica, en vez del antiguo multiplicador de 0.7 al score final.

**Razon**: El multiplicador era opaco — el estudiante veia un score bajo sin entender por que. El cap explicito en una dimension especifica permite feedback claro: "tu respuesta es generica, por eso la dimension X tiene tope 50".

**Trade-off**: Menos severo que 0.7x al total. Aceptable porque la penalidad ahora es explicable.

**No revertir salvo si**: Se necesita una penalidad mas severa para respuestas genericas que no se logra con el cap.

---

### D6: Rondas diagnosticas (non-ranked) con extraccion de senales (2026-03-06)

**Decision**: Sesion 1 tiene 3 rondas diagnosticas (R4-R6) que NO afectan el ranking. Los jueces evaluan normalmente pero ademas extraen `parsedSignals` para formacion de grupos.

**Razon**: Necesitabamos informacion sobre preferencias, estilos de trabajo y senales implicitas sin presion competitiva. Las rondas diagnosticas permiten recoger esta informacion en el mismo flujo de juego.

**Trade-off**: Los estudiantes podrian tomar menos en serio las rondas sin ranking. Mitigado porque los jueces siguen dando feedback.

**No revertir salvo si**: Se encuentra mejor mecanismo para recoger senales fuera del juego.

---

### D7: Respuestas con tags forzados (2026-03-06)

**Decision**: Cada pregunta exige respuesta con tags exactos: `[CAMPO] contenido`. Los jueces ven la respuesta con esos tags.

**Razon**: Fuerza estructura, evita respuestas tipo ensayo, y facilita la evaluacion por parte de los jueces IA (pueden mapear cada campo a criterios especificos).

**Trade-off**: Limita expresion libre. Aceptable porque el objetivo es evaluacion de pensamiento aplicado, no de escritura.

**No revertir salvo si**: Se demuestra que los tags impiden respuestas valiosas que no encajan en la estructura.

---

## Anti-patrones Detectados

### AP1: Respuestas ideales sobre-prescriptivas
No volver a usar `idealAnswer` como solucionario unico. El juez IA lo trata como checklist y penaliza respuestas correctas pero formuladas distinto. Usar `evaluationGuide` con `must_hit` (conceptos obligatorios) + `partial_credit` (niveles).

### AP2: Hard penalties para todo
No usar mas de 3 hard penalties por sesion. Si todo es "grave", nada es grave. Reservar caps para errores que invalidan la comprension fundamental.

### AP3: Premiar jerga sobre causalidad
Los jueces tienden a dar puntos por mencionar terminologia correcta. Lo que importa es si el estudiante conecta concepto con consecuencia. Las penalidades por tecnicismos no ensenados existen exactamente para esto.

### AP4: Prompts de jueces demasiado largos
El knowledge base se inyecta completo (~235 lineas). Cada token adicional en el prompt reduce la capacidad del juez de procesar la respuesta del estudiante. No agregar secciones al prompt a menos que resuelvan un problema concreto de scoring.

### AP5: Dimensiones no ortogonales
Si dos dimensiones miden cosas parecidas, el juez va a dar scores correlacionados y el sistema pierde resolucion. Cada dimension debe capturar algo que las otras no.

### AP6: Penalidades no verificables por LLM
"Falta de pensamiento critico" no es verificable. "No menciona vigencia documental en un caso normativo" si lo es. Las penalidades deben referirse a presencia/ausencia de contenido especifico.

---

## Criterios No Negociables

1. **Sobriedad sobre entusiasmo**: Una respuesta que conecta concepto con consecuencia vale mas que una llena de terminologia correcta pero abstracta.

2. **Evaluacion solo de lo escrito**: Los jueces no deben asumir informacion faltante ni dar credito por "probablemente quiso decir".

3. **Contexto institucional**: Las respuestas deben aplicarse al caso concreto, no ser genericas. Una respuesta que podria servir para cualquier caso sin modificacion tiene tope.

4. **Backward compatibility**: Cambios en el sistema de evaluacion no deben romper sesiones anteriores. El formato antiguo sigue siendo parseado.

5. **3 jueces con lentes distintos**: Cada juez aporta una perspectiva unica. Si dos jueces dieran siempre el mismo score, uno sobra.
