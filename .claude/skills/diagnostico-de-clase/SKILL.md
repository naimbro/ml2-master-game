---
name: diagnostico-de-clase
description: Use after a game has been played with a real class, to measure it and write its ficha — "cómo salió el juego de la clase X", "los alumnos dijeron que faltó tiempo", "medir el juego que jugamos", "qué le cambio al juego de la próxima clase", "por qué sacó tan mala nota el juego". Also use when a course is about to get a new session and nobody has measured the previous one.
---

# Diagnóstico de clase

Corre el medidor sobre un juego ya jugado, lee los comentarios de los alumnos, y
deja una **ficha** en la carpeta de la sesión: `diagnostico.md`.

**En una línea: la ficha describe lo que pasó; no rediseña el juego que ya se
jugó.** Su destinatario es el juego *siguiente* de ese curso. Ver la sección 5,
que es la que manda sobre todas.

## Por qué existe

El 21-sep-2026 la clase 7 de dataviz (`9XR4Z6`, 24 jugadores, seis abiertas de
código R) sacó **4,50/7, la nota más baja del año** —las anteriores iban de 5,79
a 6,4— y **las quince respuestas de feedback dejaron catorce comentarios, y los
catorce hablaban de falta de tiempo**.
No había ninguna forma de medirlo: el feedback se archivaba, la telemetría se
olvidaba, y la clase siguiente repetía el mismo error de reloj con otras
palabras. Esta ficha es el único canal por el que el aprendizaje de una clase
llega a la próxima.

---

## 1. Correr el medidor

```bash
npm run diagnostico 9XR4Z6        # el detalle de un juego, por su código de 6 letras
```

**Si no se sabe el código**, sin argumentos lista todos los juegos terminados
con **10 o más jugadores** —el piso que separa una clase de una prueba del
profesor— e imprime de cada uno **sólo lo que disparó una regla**:

```bash
npm run diagnostico
```

No hay que reconstruir ningún cálculo a mano: el medidor importa la recta de
lectura de `src/lib/abiertaTiming.ts`, que es la misma que usa el validador de
contenido. **No copiar esos números a un script propio**: el día que la recta se
recalibre, la copia queda midiendo otra cosa en silencio.

`npm run diagnostico -- --calibrar` reajusta la recta con todos los juegos. **No
es parte de este flujo** y no se corre de pasada: mover la recta mueve el piso de
reloj de todas las sesiones del repo a la vez.

## 2. Leer los comentarios completos, no el promedio

El script imprime **las respuestas de feedback enteras, una por una, con nombre y
nota**. Es a propósito y no se resume: quince comentarios se leen en un minuto, y
**el promedio esconde justo lo que sirve.** En `9XR4Z6` el promedio era 4,50 —un
número que no dice nada más que "salió mal"— y los catorce comentarios que
traían texto decían la misma palabra: *tiempo*.

Leerlos antes de mirar la tabla. La tabla dice qué ronda; los comentarios dicen
qué se sintió, y a veces contradicen lo que la tabla sugiere.

## 3. Un veredicto por ronda

El script ya imprime un bloque `VEREDICTO POR RONDA` con las reglas aplicadas.
Esta sección es cómo se **leen**, que es lo que el script no puede hacer por sí
solo.

Las columnas de la tabla de abiertas:

| columna | qué es |
|---|---|
| `pal` | palabras del enunciado (`context ?? prompt`, más `question`) |
| `pred` | lectura que predice la recta: `13 s + 0,32 s/palabra` (0,25 en código) |
| `real` | lectura medida: mediana de los segundos hasta la primera tecla |
| `resid` | `real − pred`. El detector de mala redacción |
| `tecleo` | mediana de segundos entre la primera tecla y el 95% del texto final |
| `colg` | % que seguía escribiendo en los últimos 20 s. **Sólo en código** |
| `reloj` | el `durationSeconds` escrito en la sesión |
| `ofrec` | el escrito más lo que el anfitrión agregó en vivo con «+30 s» |
| `cierre` | último envío medido en los relojes de los alumnos |
| `pedía` | el piso que `relojDerivadoAbierta()` exige hoy |
| `n` | cuántas telemetrías útiles entraron en esa mediana |

### Las reglas de lectura

**`resid > +15 s` → la ronda costó más de lo que su largo explica.** De ahí
salen **dos veredictos distintos**, y el script elige cuál imprime según el largo
del enunciado. **No hay nada que aplicar a mano acá: hay que saber leer cuál de
los dos salió.**

**«EL ENUNCIADO CONFUNDE» (70 palabras o más) → se reescribe la pregunta, NO se
alarga el reloj.** Un enunciado largo que además cuesta más de lo que su largo
predice es un enunciado confuso. Alargarle el reloj compra tiempo para seguir sin
entender. Cuáles son los peores del repo en cada momento lo dice
`npm run diagnostico -- --calibrar`, que los lista ordenados; no vale la pena
memorizar una lista que envejece con cada juego nuevo.

**«el largo no explica nada: puede ser que no supieran por dónde empezar» (menos
de 70 palabras) → el problema es la pregunta, no su texto.** Debajo de ese largo
la recta predice casi su propio piso —13 s de abrir la pantalla y ubicarse— y
**cualquier titubeo se cobra como mala redacción aunque no lo sea**: pensar la
respuesta, no saberla, entrar tarde a la ronda. El caso real: `6CNGSG` R2,
**26 palabras**, residual **+23 s**, y no hay nada mal redactado ahí. Veintiséis
palabras no alcanzan para redactar mal nada. Lo que hay que mirar es si la
pregunta da un punto de partida.

> **El corte son 70 palabras** (`PISO_PALABRAS_VEREDICTO` en
> `scripts/diagnostico.ts`), y es un número **elegido, no medido**. Lo que lo
> respalda es que separa el caso de 26 palabras que no está mal escrita de las
> cuatro del repo que sí conviene reescribir —92, 139, 145 y 421 palabras—, y que
> cualquier piso entre 60 y 80 deja el mismo corte. **Si alguna vez hay que
> moverlo, se mueve en el script y no acá**: dos umbrales para la misma regla,
> uno en el medidor y otro en este skill, es exactamente la divergencia silenciosa
> que todo este trabajo existe para matar.

**`colg > 40%` → el reloj no alcanzó.** Se corta el enunciado o se sube
`difficulty`, que es lo que paga el tecleo. **Sólo existe en código.** En prosa
esa columna **no se imprime**: es 76-100% siempre, en los cinco cursos, porque en
un ensayo la gente escribe hasta la chicharra por definición. **Si algún día
aparece un `colg` en una ronda de prosa, es un bug del medidor** — no un
hallazgo.

**Hubo extensiones (`ofrec` > `reloj`, en pasos de 30 s) → el reloj escrito
estaba mal por esa cantidad, y no es una opinión.** El profesor lo corrigió en
vivo, con la clase adelante y el costo de pared encima. Es el dato más duro de
toda la tabla: si el anfitrión apretó «+30 s» dos veces, a esa ronda le faltaban
60 s.

**`cierre` bastante menor que `ofrec` → la ronda terminó antes de la chicharra.**
Dos causas, y **el script no puede distinguirlas**: o el anfitrión cortó a mano
con «Terminar Ronda», o todos habían enviado ya. El cierre por ronda no se guarda
en Firestore. **El script no elige y la ficha tampoco debe elegir sola:
preguntarle a Naim, que se acuerda.** Las dos conclusiones son opuestas —una dice
"sobraba reloj", la otra "se perdió tiempo de respuesta"—, así que inventarla
cuesta caro.

**`reloj` < `pedía` → esa sesión no pasaría el validador de hoy.** Se anota como
hecho y nada más: la sesión ya se jugó, y el arreglo es del contenido que viene.

> **Y al revés NO vale: `pedía` ≤ `reloj` no es un certificado de que el reloj
> alcanzó.** En `9XR4Z6` la R5 tenía 120 s escritos contra 120 s que pedía
> `relojDerivadoAbierta()` —clavado, aprobada por el validador— y el **62%** del
> curso seguía escribiendo en los últimos 20 s. El piso derivado es una
> predicción; `colg` es la medición. **Cuando los dos se contradicen, manda
> `colg`.**

**Pared > 20 min → sobran rondas, y las últimas probablemente no se jugaron.**
**Verificarlo siempre, porque el script cuenta las rondas *escritas*:** un juego
cortado tiene menos rondas jugadas que diseñadas, y entonces todo lo que la tabla
dice de las últimas filas es sobre rondas que nadie vio.

**"Probablemente" y no "seguro":** `9XR4Z6` desbordó por 6 min y jugó las seis
rondas igual. Cuando eso pasa, el desborde no desaparece — **se pagó en el reloj
de todas las rondas**, y ahí está la mitad de las catorce quejas de tiempo. La
ficha tiene que decir cuál de los dos costos se pagó, porque llevan a cambios
distintos: perder la última ronda se arregla sacando rondas, y apretar el reloj
de todas también, pero nadie lo va a creer si la ficha no dice que ninguna ronda
se perdió.

```bash
node -e "
const admin=require('firebase-admin');
admin.initializeApp({projectId:'ml2-master-game'});
const db=admin.firestore(); db.settings({preferRest:true});
(async()=>{
  const g=await db.collection('games').doc('<CÓDIGO>').get();
  const rs=await db.collection('games').doc('<CÓDIGO>').collection('rounds').get();
  console.log('escenarios escritos:',(g.data().scenarios||[]).length,'| rondas jugadas:',rs.size);
  process.exit(0);
})();"
```

El `preferRest` no es opcional: sin él los scripts de análisis se cuelgan mudos
en el primer `.get()` de una subcolección.

### Cruzar `colg` con `difficulty`, que no está en la tabla

El medidor no imprime `difficulty`, y en `9XR4Z6` el hallazgo más fuerte de toda
la ficha salió de cruzarlo a mano: **las tres rondas que no alcanzaron eran
exactamente las tres etiquetadas `medium`**, y las `hard` y la `easy` alcanzaron.
`difficulty` es lo que paga el tecleo (45 / 70 / 120 s en código), así que un
`colg` alto concentrado en una etiqueta dice que ese presupuesto de tecleo está
corto **para este curso**, que es el tipo de cosa que sólo se ve jugando.

**El `difficulty` que importa es el del juego, no el del archivo.** El juego
guarda una **copia congelada** de los escenarios en `games/<CÓDIGO>.scenarios`, y
`content/sessions/.../scenarios.json` puede haber cambiado después de jugar —en
`9XR4Z6` cambió: relojes y una pregunta entera. **La ficha describe la copia
congelada.** Leerla de ahí:

```bash
node -e "
const admin=require('firebase-admin');
admin.initializeApp({projectId:'ml2-master-game'});
const db=admin.firestore(); db.settings({preferRest:true});
(async()=>{
  const d=(await db.collection('games').doc('<CÓDIGO>').get()).data();
  console.log('roundExtensions',JSON.stringify(d.roundExtensions||{}));
  (d.scenarios||[]).forEach((s,i)=>
    console.log('R'+(i+1),s.title,'|',s.difficulty,'|',s.durationSeconds,'|',s.answerFormat));
  process.exit(0);
})();"
```

### Largo y confuso son dos defectos distintos

Es la lectura que más se equivoca, y la que hace falta tener clara antes de
escribir la ficha. Una ronda puede tener **`colg` alto y `resid` negativo** al
mismo tiempo: los alumnos entendieron la pregunta rápido y no les alcanzó el
reloj para contestarla. Eso no es mala redacción — **es un enunciado largo, o una
respuesta que pide más tecleo del que el reloj paga.** La cura es distinta: la
mala redacción se reescribe, el largo se recorta o se paga.

Las seis rondas de `9XR4Z6` son exactamente ese caso, y por eso vale la pena
mirarlas antes de diagnosticar otra cosa.

## 4. Escribir la ficha

Va en `content/sessions/<curso>/<clase>/diagnostico.md`, al lado del
`scenarios.json` de esa sesión.

**Una ficha por juego jugado con un curso completo.** Las pruebas del profesor
solo no llevan ficha: sin 10 alumnos las medianas son ruido, y el medidor ni
siquiera las lista. Si un curso jugó dos veces la misma sesión, la ficha es la
del juego oficial.

**Tiene que caber en una pantalla.** No es un informe: es la nota que el autor
del próximo juego va a leer en dos minutos antes de escribir preguntas.

La estructura:

1. **Encabezado**: código, fecha, curso y clase, jugadores, nota promedio (y
   sobre cuántas respuestas).
2. **La tabla por ronda**, pegada del medidor. Los números salen del script, no
   de la memoria: **no se redondean ni se adornan.**
3. **Qué pasó**, en tres o cuatro frases: el veredicto leído, incluyendo lo que
   el script no puede decidir y se averiguó preguntando.
4. **Los comentarios, agrupados por tema**, con cuántos dijeron cada cosa y una
   o dos citas textuales. Agrupar leyendo, con la cabeza. **Nunca pasarlos por
   un modelo para que los clasifique**: son quince.
5. **Qué cambiar**, una lista corta y accionable, dirigida al juego siguiente.
   Cada ítem con el número que lo respalda.

La ficha termina ahí. Si una lista de "qué cambiar" pasa de seis ítems, es que
se está rediseñando el juego viejo — ver la sección 5.

## 5. La regla que manda

> ## La ficha describe lo que pasó. No rediseña el juego que ya se jugó.
>
> Es una decisión explícita de Naim. **El aprendizaje va al *siguiente* juego**,
> no a arreglar uno que ya ocurrió: corregirle los relojes a una sesión jugada no
> le devuelve el tiempo a nadie, y deja el repo diciendo que la clase pasó como
> no pasó. Peor: si `scenarios.json` se edita después del juego, la ficha deja de
> calzar con lo que el curso vio, y la próxima vez que alguien la lea va a estar
> leyendo un juego que no existió.

El destinatario de la ficha es **`autor-de-contenido` cuando escriba la clase
siguiente de ese curso**, y en segundo lugar `autor-de-rubricas`. Los dos skills
ya arrancan leyendo `content/sessions/<curso>/*/diagnostico.md` antes de escribir
una sola pregunta o un solo criterio. Escribir para ese lector: lo que le sirve
es "en este curso, con estos alumnos, un enunciado de 179 palabras se comió 54 s
de un reloj de 120", no un juicio sobre la sesión.

Corolario para `autor-de-rubricas`: **un puntaje bajo que en realidad fue falta
de tiempo no se arregla tocando anclas.** Si una ronda quedó censurada por el
reloj, sus respuestas están truncas, y bajar las anclas para que "pasen" premia a
quien escribió poco. La ficha tiene que dejar dicho cuáles rondas están en esa
situación.

## 6. Qué NO hace este skill

- **No toca contenido.** Ni `scenarios.json`, ni `rubric.json`, ni el
  `knowledge_base.md`. Escribe un solo archivo: `diagnostico.md`.
- **No cambia los relojes de sesiones ya jugadas.** Ver la sección 5.
- **No clasifica los comentarios con ningún modelo.** Quince comentarios se leen.
  Un clasificador acá agrega una capa de error sobre el único dato del juego que
  viene en las palabras de los alumnos.
- **No recalibra la recta.** `--calibrar` existe, pero mover `abiertaTiming.ts`
  es un commit deliberado y aparte, porque mueve el piso de reloj de todo el
  repo.
- **No opina sobre las preguntas.** Si el diagnóstico sugiere que una pregunta
  estaba mal planteada, eso se anota como hallazgo y se resuelve en
  `autor-de-contenido`, con el material de clase adelante.
