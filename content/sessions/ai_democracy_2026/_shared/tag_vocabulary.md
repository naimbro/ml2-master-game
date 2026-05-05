# Vocabulario de Tags Forzados — IA y Democracia 2026

Este documento define los tags estructurados que los escenarios pueden exigir
en las respuestas de los estudiantes. La idea es que el estudiante no pueda
"esconder" la vaguedad: cada tag obliga a hacer visible una operacion mental
concreta (identificar un actor, nombrar un derecho, declarar un mecanismo).

Los tags NO son obligatorios en cada escenario. Cada escenario declara los
suyos en el campo `requiredTags` y los repite explicitamente en el prompt
de la pregunta. El juez LLM verifica via la rubrica que aparezcan.

---

## Tags base del curso

### `[ACTOR_AFECTADO]`
Quien se ve concretamente afectado por la decision o sistema descrito —
identificado como rol/grupo, no como abstraccion ("ciudadania", "sociedad").
Premia identificar al menos un actor sin voz organizada o presencia institucional.

Ejemplo bueno: "Personas mayores que tramitan pensiones por canal presencial."
Ejemplo malo: "Los usuarios."

### `[DERECHO_EN_TENSION]`
Que derecho fundamental, garantia constitucional o estandar democratico
entra en tension con la decision. Idealmente nombra dos en conflicto.

Ejemplo bueno: "Libertad de expresion del autor del contenido vs. proteccion
del proceso electoral en periodo de campana."
Ejemplo malo: "Los derechos humanos."

### `[ASIMETRIA_DE_PODER]`
Quien tiene mas capacidad de incidir, recursos, informacion o acceso
respecto a quien queda mas vulnerable. Premia identificar asimetrias
no obvias (no solo "Estado vs. ciudadano", sino tambien "plataforma
privada vs. autoridad regulatoria con escasos recursos tecnicos").

### `[MECANISMO_RENDICION_CUENTAS]`
Mecanismo concreto y operacional, no decorativo. "Transparencia" sola
no cuenta — debe nombrar quien rinde cuentas, ante quien, con que
frecuencia, con que consecuencias si falla. Ejemplos validos:
auditoria publica con muestra obligatoria, registro de decisiones
con derecho a revision humana, reporte trimestral al regulador con
sancion en caso de incumplimiento.

### `[REVERSIBILIDAD]`
Si la decision o despliegue se puede revertir, en que plazo, a que
costo, y quien tiene la potestad de hacerlo. Decisiones irreversibles
de bajo costo politico merecen mas escrutinio que decisiones reversibles.

### `[LEGITIMIDAD_VS_LEGALIDAD]`
Distincion explicita entre lo legal (cumple la norma vigente) y lo
legitimo (es democraticamente aceptable a la luz de los fines de la
norma y de los afectados). Una respuesta puede declarar que algo es
"legal pero ilegitimo" o "legitimo aun si no esta regulado".

### `[RIESGO_DE_CAPTURA]`
Riesgo de que el diseno institucional propuesto sea capturado por un
actor con interes particular: una empresa proveedora, un partido, un
grupo de presion, una agencia con incentivo de auto-preservacion.
Premia nombrar al actor capturador concreto.

### `[SUPUESTO_CRITICO]`
Supuesto que sostiene el argumento y cuyo colapso lo invalida. Obliga
a hacer explicito lo que se esta dando por sentado (capacidad tecnica,
buena fe del actor X, disponibilidad de datos, voluntad politica, etc).

---

## Tags suplementarios (opcionales por unidad)

### `[FRENTE_DE_DANO]`
Para escenarios sobre amenazas (unidades 2-4): donde concretamente se
materializa el dano —- electoral, deliberativo, de privacidad, de
acceso a la informacion, de pluralismo mediatico, etc.

### `[ESCALA_TEMPORAL]`
Plazo en que el dano o beneficio se manifiesta. Distingue dano agudo
(eleccion de 2026) de dano estructural (erosion de confianza a 5 anos).

### `[CONTRA_FACTUAL]`
Que pasaria sin el sistema/regulacion/intervencion. Obliga a comparar
contra una linea base, no contra un ideal.

### `[INSTRUMENTO_REGULATORIO]`
Tipo de instrumento usado: ley, decreto, autoregulacion, codigo de
conducta, prohibicion, moratoria, sandbox, certificacion, etiquetado
obligatorio. Premia que el instrumento sea proporcional al riesgo.

### `[FORMA_DE_PARTICIPACION]`
Para unidad 5 (democracia deliberativa): que rol juega la ciudadania
en el diseno o ejecucion — consulta vinculante, deliberacion sorteada,
co-creacion, rendicion ex-post, mero feedback.

---

## Convenciones

1. Los tags van entre corchetes y en MAYUSCULAS, sin acentos en el codigo
   del tag (para evitar problemas de encoding en el LLM). Las descripciones
   y contenidos en espanol pueden llevar acentos.
2. Cada escenario declara su set en `requiredTags: ["ACTOR_AFECTADO", ...]`
   en el JSON, y los repite literalmente en el campo `question` para que
   el estudiante sepa exactamente que debe escribir.
3. La rubrica del curso penaliza explicitamente la ausencia de tags
   solicitados (ver `globalPenalties`).
4. Tags tienen un costo cognitivo. No exijas mas de 5 tags por respuesta
   en una ronda de 5 minutos. Para rondas cortas (180s) usa 3 maximo.

---

## TODO para el profesor

- [ ] Decidir si quieres exponer una version corta de este vocabulario
      a los estudiantes antes de la primera clase, o si prefieres que
      lo aprendan por uso.
- [ ] Definir si algun tag adicional emerge tras la unidad 1 que valga
      la pena estandarizar (ej: `[ACTOR_NO_HUMANO]` para sistemas
      autonomos, `[INVERSION_DE_LA_CARGA]` para regulacion proactiva).
