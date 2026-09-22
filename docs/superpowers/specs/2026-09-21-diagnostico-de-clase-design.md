# Diagnóstico de clase: el reloj de las rondas abiertas se calcula

**Fecha:** 2026-09-21
**Origen:** dataviz clase 7 (`9XR4Z6`, 24 jugadores). Nota **4,50/7** — la más baja del año,
contra 5,79 de la peor anterior. **Los 15 comentarios hablan de tiempo. Los 15.**

---

## El problema

El reloj de una ronda abierta (`durationSeconds`) se escribe a mano. No hay nada que lo verifique,
y la misma queja vuelve clase tras clase sin que ningún número la ataje. Las de alternativas sí
tienen defensa desde agosto: `mcTiming.ts` deriva el reloj del bloque y `validate-content.cjs`
falla el build si no alcanza. Las abiertas no tienen equivalente.

Dos alumnos dijeron dónde se va el tiempo, y son dos defectos distintos:

> «demora mucho tiempo entender la pregunta y ver qué están preguntando»
> «muy poco tiempo **contando la lectura** del ejercicio», «mucho contexto que leer»

## Lo medido

**36 rondas abiertas con telemetría** (16 juegos, 5 cursos, prosa y código). La telemetría de
escritura —que existe desde agosto para otra cosa: detectar copiado— resulta ser el instrumento:
`msPrimeraTecla` es cuánto tardó cada alumno en entender el enunciado, y `huella` es cómo creció
su texto segundo a segundo.

```
corr(palabras del enunciado, segundos hasta la 1ª tecla) = 0,91
lectura ≈ 13 s + 0,32 s × palabra        (n = 35, RMSE 12 s)
```

El enunciado cuesta **un tercio de segundo por palabra**, y el código se lee más rápido que la
prosa a igual número de palabras (0,25 s/palabra: un bloque de código cuenta muchas «palabras»
pero se escanea).

### Los tres hallazgos que mandan sobre el diseño

**1. El reloj de hoy estaba mal por una cuenta, no por una intuición.**

| ronda | palabras | lectura medida | reloj | queda para escribir | seguían escribiendo al final |
|---|---|---|---|---|---|
| R1 | 83 | 31 s | 120 s | 89 s | **9%** |
| R2 | 85 | 37 s | 120 s | 83 s | 57% |
| R3 | 162 | 40 s | 180 s | 140 s | 33% |
| R4 | **179** | **54 s** | 120 s | **66 s** | 55% |
| R5 | 118 | 44 s | 120 s | 76 s | **62%** |
| R6 | 127 | 41 s | 180 s | 139 s | **14%** |

Las dos rondas que alcanzaron (R1, R6) son exactamente las que dejaban ~90-140 s después de leer.
La cuenta honesta para R4 era **180 s, no 120**: 58 s de lectura predicha (54 medidos) más los
~120 s que cuesta teclear una cadena de dos o tres pasos.

**2. «Cuántos seguían escribiendo al final» sirve para código y NO para prosa.**
En las rondas de prosa ese número es 76-100% **siempre**, en los cinco cursos: en un ensayo la
gente escribe hasta la chicharra por definición. En código discrimina limpio (9, 14, 28, 28 vs
55, 57, 62). Una sola métrica para los dos tipos habría dado una falsa alarma permanente en
MGT300 y AyD.

**3. El residual de la recta es el detector de mala redacción.** Una pregunta que cuesta mucho
más de lo que su largo predice es una pregunta confusa:

```
VHCZ5V R1  139 pal: predice 58 s, costó 89 s   (+31)
6CNGSG R2   26 pal: predice 22 s, costó 44 s   (+22)
N9YHC5 R3   92 pal: predice 43 s, costó 61 s   (+18)
```

Las seis de hoy salen **por debajo** de la recta (R3: 162 palabras, predice 65 s, costó 40). Las
preguntas de hoy no estaban mal redactadas: **estaban largas**. Son dos defectos distintos y
ahora hay un número para cada uno.

---

## El diseño

### 1. `src/lib/abiertaTiming.ts` — el reloj se calcula, no se escribe

Gemelo de `mcTiming.ts`:

```
reloj = costoDeLectura(enunciado, answerFormat) + costoDeEscritura(difficulty)

costoDeLectura = 13 s + 0,32 s × palabra      (prosa)
               = 13 s + 0,25 s × palabra      (answerFormat: 'code')

y el resultado se sirve redondeado hacia arriba al múltiplo de 15 s
```

El escalón de 15 s no es cosmético: un reloj de 178 en pantalla no dice nada, y redondear hacia
abajo convertiría el piso en un techo.

`validate-content.cjs` **falla el build** si `durationSeconds` queda por debajo del derivado.

Con dos correcciones que aparecieron al leer el código:

- **Hoy el validador no está enganchado a nada.** No lo llama `npm run build` ni
  `.github/workflows/deploy.yml`; es un script que se corre a mano. «Falla el build» es una forma
  de decir. Engancharlo como `prebuild` es parte de este trabajo, y va *después* de la migración
  de contenido para no dejar `main` en rojo.
- **Error en los cursos vivos, advertencia en los retirados.** `dataviz_2026`, `mgt300_2026` y
  `ai_democracy_2026` fallan; `ml2-2025`, `temas_emergentes_2026` y `mundial_2026` avisan. El
  reloj de una sesión que no se va a volver a dictar no le puede hacer daño a nadie, y son 37
  escenarios de juicio sin destinatario.

**Efecto secundario deliberado:** un enunciado largo encarece su propia ronda, y como el
presupuesto de 15-20 minutos de pared no se mueve, la verborrea se paga sacando una ronda. Es la
única forma de que «escribe más corto» tenga consecuencia en vez de ser un consejo.

### 2. `difficulty` deja de ser decorativo

Hoy el campo existe en el schema, se le muestra al alumno, y no hace nada. Pasa a significar
**cuánto se tarda en teclear la respuesta**, que es lo único de la dificultad que consume reloj.

El presupuesto de escritura sale de **dos campos que ya existen**, `answerFormat` y `difficulty`.
Un `difficulty` con un cuarto valor `prose` sería un enum mintiendo sobre su nombre:

| | `easy` | `medium` | `hard` |
|---|---|---|---|
| `answerFormat: 'code'` | 45 s — un nombre de función | 70 s — una línea | 120 s — dos o tres pasos encadenados |
| prosa (por defecto) | 90 s — una frase | 150 s — un párrafo | 210 s — argumento con evidencia |

**Se deja de mostrar al alumno** (`Round.tsx:1034-1047`). Leer «difícil» antes de empezar
desanima a quien iba a intentarlo, y la etiqueta ya no describe la dificultad conceptual sino el
largo de la respuesta: mostrarla diría algo falso.

**Honestidad sobre estos números:** los de código están medidos (R1 de hoy: 72 s de escritura
mediana con 9% colgando; R3 y R6: ~120 s con 14-33%). **Los de prosa no se pueden medir y son una
decisión**, porque toda ronda de prosa está censurada por el reloj — el 76-100% que sigue
escribiendo al final significa que nunca observamos cuánto habrían escrito. Queda anotado como la
primera pregunta que el diagnóstico debe responder una vez que exista: *¿a partir de qué largo de
respuesta el puntaje deja de subir?* Ese es el presupuesto defendible para prosa.

### 3. Botón «+30 s» en vivo, sólo en rondas abiertas

`roundEndTime` ya es un campo compartido que leen las dos puntas —el teléfono del alumno
(`Round.tsx:152`) y el auto-cierre del anfitrión (`useGame.ts:513`)—, así que el botón es un
`updateDoc`. Apretable cuantas veces haga falta.

- **No se ofrece en rondas MC.** Las MC no leen `roundEndTime`: derivan todo de `roundStartTime`
  más los límites por pregunta (`mcTimeline`). Empujar el fin desincroniza el bloque en vez de
  alargarlo.
- **Cada apretón se registra** en `game.roundExtensions`, un mapa `{ "4": 60 }` de ronda a segundos
  agregados. NO en `rounds/round_{n}`: esa subcolección es `allow write: if false` en
  `firestore.rules:241` y sólo la escriben las Cloud Functions. El doc del juego es
  `allow update: if isAuthenticated()`, así que el botón no necesita tocar las reglas.
  Sin ese registro el botón
  rompe la medición que lo justificó: el diagnóstico compararía los envíos contra el
  `durationSeconds` escrito y vería al curso entero entregando al 150% del reloj. Con el registro,
  «en R4 tuviste que apretar +30 dos veces» es la señal más fuerte que existe para la próxima
  edición de esa clase.

### 4. `scripts/diagnostico.ts <CÓDIGO>` — el medidor

Una corrida después de cada clase. Por ronda abierta: palabras, lectura predicha contra la real
(y el residual), escritura, % colgando **sólo si `answerFormat: 'code'`**, segundos agregados a
mano. Por ronda MC: lo que hoy hace `mc-clock.ts`, absorbido. Y del juego entero: pared contra
presupuesto, nota media y comentarios.

`--calibrar` reajusta la recta con todos los juegos y **imprime** las constantes nuevas. No las
escribe: cambiar `abiertaTiming.ts` es un commit deliberado, porque mueve el piso de todas las
sesiones del repo a la vez.

### 5. El skill `diagnostico-de-clase`

Corre el script, lee los comentarios, y escribe una **ficha en la carpeta de la sesión**:
`content/sessions/<curso>/<clase>/diagnostico.md`, con el veredicto por ronda y qué cambiar.

La ficha es el canal. **No sirve para rediseñar el juego que ya se jugó** — eso quedó explícito:
el aprendizaje tiene que traducirse en el *siguiente* juego. Sirve porque `autor-de-contenido` y
`autor-de-rubricas` arrancan leyendo las fichas anteriores **de ese curso**, que es donde el
aprendizaje sobrevive en vez de morir en un chat.

### 6. `autor-de-contenido` gana una sección de redacción

Con el presupuesto de palabras y reglas verificables:

- **Techo de ~90 palabras** en el enunciado de una abierta (a 0,32 s/palabra son ~42 s, el máximo
  que se puede pagar dentro de un reloj de 3 minutos). El de hoy que costó 54 s tenía **179**.
- Una sola pregunta por enunciado.
- Los datos en lista o tabla, nunca en prosa corrida.
- El verbo de la tarea solo y en la última línea.
- Nada de contexto narrativo que no se use para responder.

El techo no necesita regla propia en el validador: más palabras es más reloj, y más reloj no cabe
en el presupuesto. La regla dura ya está en el punto 1.

---

## Lo que NO entra

- **Rediseñar juegos ya jugados.** Decisión explícita de Naim.
- **Clasificar la dificultad conceptual.** El único eje que consume reloj es cuánto se tarda en
  escribir la respuesta; una pregunta conceptualmente durísima de respuesta corta necesita poco
  tiempo, y el instrumento debe decir eso.
- **Recalibrar automáticamente las constantes.** `--calibrar` imprime; la persona commitea.
- **Análisis cualitativo automático de los comentarios.** El skill los lee y los resume en la
  ficha; no hay clasificador. Con 15 comentarios por juego no hace falta.

## Riesgos

- **El botón +30 s sin registro corrompe el diagnóstico.** Mitigado por `segundosAgregados`, y es
  lo primero que hay que probar jugando.
- **Las etiquetas `difficulty` que ya existen significan otra cosa.** Los 88 escenarios abiertos
  del repo tienen una, escrita con el sentido «qué tan difícil es el concepto». La R4 de la clase
  7 —la que necesitaba 190 s— está en `medium`. O sea que la migración de verdad es
  **reetiquetar**, y los relojes salen solos después. Con las etiquetas de hoy fallarían 27
  escenarios de 12 sesiones, pero esa lista es engañosa: se recalcula después de reetiquetar.
- **El coeficiente sale de 5 cursos pero 28 de las 35 rondas son de prosa.** El 0,25 de código
  descansa en 8 rondas, seis de ellas del mismo juego. Se recalibra después de la próxima clase
  de dataviz.
