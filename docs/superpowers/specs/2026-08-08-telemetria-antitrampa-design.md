# Telemetría de escritura en las rondas abiertas

**Fecha:** 2026-08-08
**Estado:** diseño aprobado, sin implementar

## Qué problema resuelve

Naim sospecha que parte del curso responde las rondas abiertas copiando de un LLM, y hoy no
tiene ninguna forma de saber si eso pasa, ni cuánto, ni si crece. Este diseño registra **cómo
se escribió** cada respuesta abierta —no sólo qué dice— y se lo muestra en el panel del
profesor.

El objetivo de esta versión es **observar un fenómeno que nadie ha medido todavía**. No es un
sistema de detección ni de sanción.

## La regla que manda sobre todo lo demás

**Esto no castiga automáticamente.** Ninguna parte del diseño puede:

- entrar en un puntaje, en el ranking o en la recalibración por duelos;
- penalizar, bloquear o advertir a un alumno;
- ordenar una lista «por sospecha»;
- usar la palabra «copió», «trampa» o «sospechoso» en ninguna pantalla;
- aparecer en una vista del alumno, ni en la pantalla que se proyecta al curso.

Cualquier propuesta futura que rompa una de esas viñetas es un rediseño, no un ajuste.

## Decisiones tomadas

| Decisión | Qué se eligió |
|---|---|
| Cuánto detalle | Huella cruda (cómo creció el texto) **más** los derivados precalculados |
| Dónde vive | Subcolección nueva, no en el documento de la submission |
| Quién lee | Sólo el anfitrión del juego. Ni siquiera el alumno lee la suya |
| Falsos positivos | Se describe, nunca se clasifica; se agrega la señal de «salió de la app» |
| Anuncio al curso | **No se anuncia.** Es registro privado de Naim |
| Visualización | Nube del curso (agregada, sin nombres) + rejilla de huellas por alumno |
| Alcance | Sólo `ClassReport.tsx`, por juego. Nada acumulado entre sesiones todavía |

### Sobre no anunciarlo

Decisión explícita de Naim, y es su curso. La consecuencia que queda escrita acá: **mientras
no se anuncie, esto es sólo observación.** El día que un registro de éstos vaya a tener
consecuencias para una persona concreta, ese es el día de anunciarle al curso que existe —
antes de actuar, no después. Ese es un cambio de política, no de código, y no está en el
alcance de esta versión.

## Por qué no vive en el documento de la submission

`firestore.rules:101-105` dice hoy:

```
match /submissions/{submissionId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && request.resource.data.playerId == request.auth.uid;
  allow update: if false;
}
```

Cualquier alumno logueado lee todas las submissions. Y endurecer esa regla no es opción:
los alumnos las leen de verdad, en `src/hooks/useGame.ts:76` (la ronda actual, para el
contador de respuestas) y en `src/pages/student/End.tsx:86` (la colección entera, para armar
el podio de juegos viejos sin subcolección `rounds`).

Conclusión: si la telemetría entra como campos de la submission, nace pública para todo el
curso. Va en una subcolección aparte con reglas propias.

## Modelo de datos

Un documento por alumno y ronda abierta. Las rondas de selección múltiple
(`scenario.type === 'multiple_choice'`) no tienen textarea y quedan fuera por completo.

```
games/{gameCode}/telemetria/{uid}_{ronda}

  playerId              string    == request.auth.uid
  round                 number
  scenarioId            string

  // relojes, en ms desde que se le abrió la ronda a ESE alumno
  msPrimeraTecla        number | null   null si nunca escribió nada
  msEnvio               number
  roundStartOffsetMs    number    (momento del montaje) - game.roundStartTime

  // eventos de pegado reales, del evento `paste` del navegador
  pegados               Array<{ ms: number, chars: number }>

  // la huella: largo del texto muestreado cada 2 s
  huella                number[]        ~150 enteros en una ronda de 5 min
  huellaIntervaloMs     number          2000

  // foco de la pestaña
  msFueraDeApp          number    total con la pestaña oculta
  salidas               number    cuántas veces se fue
  msFueraAntesDeEscribir number

  // derivados, precalculados para que el panel no recalcule
  largoFinal                    number
  charsPegados                  number   suma de pegados[].chars
  charsEditadosTrasUltimoPegado number

  version               number    1
```

`roundStartOffsetMs` existe para poder recuperar las dos referencias temporales: cuánto pasó
desde que empezó la ronda para el curso, y cuánto desde que la vio ese alumno. Un alumno que
entra tarde no debe parecer lento.

Los tres derivados son conveniencia. **Todos se pueden recalcular desde `huella` + `pegados`.**
Ese es el punto de guardar la huella: cuando en la sesión 4 se te ocurra otra medida, la
corres sobre las sesiones 1 a 3 sin haber tenido que instrumentar nada de antemano.

### Por qué el id del documento es `{uid}_{ronda}`

El id hace el trabajo pesado de seguridad. Con un id derivado del uid:

- un alumno no puede crear el registro de otro sin que el id lo delate;
- no puede escribir dos registros para la misma ronda (el segundo `create` falla porque el
  documento ya existe);
- con `update` y `delete` cerrados, no puede reescribir el suyo después de verlo.

## Reglas de Firestore

Van dentro del bloque `match /games/{gameCode}` de `firestore.rules`, junto a `feedback`:

```
// Como se escribio cada respuesta abierta. Registro privado del anfitrion:
// NO puntua, NO penaliza y NO se le muestra a ningun alumno, ni siquiera la
// suya — leerla ensena exactamente que hay que enganar.
//
// El id del doc es {uid}_{ronda}: eso impide escribir el registro de otro y
// impide reescribir el propio (crear falla si ya existe; update esta cerrado).
match /telemetria/{telemetriaId} {
  allow read: if isAuthenticated() &&
              get(/databases/$(database)/documents/games/$(gameCode)).data.hostId == request.auth.uid;
  allow create: if isAuthenticated()
                && request.resource.data.playerId == request.auth.uid
                && telemetriaId == request.auth.uid + '_' + string(request.resource.data.round);
  allow update, delete: if false;
}
```

El `get()` sobre el documento del juego es el mismo patrón que ya usa la regla de `feedback`
unas líneas más arriba.

### Lo que estas reglas NO impiden

Los números se producen en el navegador del alumno. Alguien con la consola abierta puede
mandar la telemetría que quiera. Las reglas cierran el hueco de *escribir la de otro* y el de
*editarla después*; no cierran el de *inventarse la propia*.

**Esto mide a la mayoría honesta. No atrapa a quien se lo propone.** Está bien: el propósito
declarado es ver la forma del fenómeno, no construir un caso contra nadie.

## Captura en el cliente

### Módulo nuevo: `src/hooks/useTypingTelemetry.ts`

Un hook que le entrega manejadores al textarea y devuelve una foto al enviar.

```ts
const telemetry = useTypingTelemetry({ enabled, scenarioId, roundStartTime });

telemetry.handlers   // { onPaste }  — se esparcen sobre el <textarea>
telemetry.noteChange(value)   // se llama desde el onChange que ya existe
telemetry.snapshot()          // devuelve el payload, o null si esta apagado
```

Reglas internas:

- **Todo el estado vive en `useRef`, nunca en `useState`.** Ya nos pasó una vez que dos
  caminos escribieran con estado de React y ambos ganaran (ver el cerrojo de doble submission
  en `mc_double_submission_lock`). Además el muestreo por intervalo con `useState` lee valores
  viejos.
- El muestreo es un `setInterval` de 2 s que lee el ref del largo actual. Se limpia al
  desmontar y al cambiar de ronda.
- `onPaste` corre **antes** de que el value se actualice. El tamaño se toma de
  `e.clipboardData.getData('text').length`, que es lo que entró, y no del delta del textarea
  (que sería distinto si había texto seleccionado).
- `msFueraDeApp` se acumula con `document.addEventListener('visibilitychange', ...)`. En el
  Safari de iOS y en Chrome de Android eso dispara al cambiar de app, que es el caso real: el
  alumno juega en el teléfono.
- El hook se resetea al cambiar `game.currentRound`.

### Cambio en `src/pages/student/Round.tsx`

El textarea de la línea ~1067 pasa de

```tsx
<textarea value={response} onChange={(e) => setResponse(e.target.value)} ... />
```

a llamar además a `telemetry.noteChange(e.target.value)` y recibir `{...telemetry.handlers}`.

`handleSubmit` (línea 354) pasa `telemetry.snapshot()` como segundo argumento de
`submitAnswer`. El auto-envío por tiempo agotado (línea 377) usa el mismo `handleSubmit`, así
que queda cubierto sin tocarlo.

### Cambio en `src/hooks/useGame.ts`

`submitAnswer` (línea 202) cambia de firma a `submitAnswer(response, telemetria?)`. Después
del `addDoc` de la submission que ya existe, escribe el registro:

```ts
if (telemetria) {
  const ref = doc(db, 'games', gameCode, 'telemetria', `${user.uid}_${game.currentRound}`);
  setDoc(ref, { ...telemetria, playerId: user.uid, round: game.currentRound, version: 1 })
    .catch(err => console.warn('telemetria no guardada', err));
}
```

**Fire-and-forget con `catch`, y después del `addDoc`.** Si la escritura falla —regla
rechazada, red caída, el documento ya existía— el alumno igual mandó su respuesta y no se
entera de nada. La telemetría jamás puede romper el envío ni retrasarlo.

### Módulo nuevo: `src/lib/telemetriaDerived.ts`

Funciones puras, sin Firestore ni React, que toman `{ huella, pegados, ... }` y devuelven lo
que el panel necesita: el porcentaje del texto que entró pegado, los puntos normalizados de la
sparkline, la lista de hechos del cajón de detalle. Acá es donde vive la lógica testeable.

## El panel del profesor

Sección nueva en `src/pages/professor/ClassReport.tsx`, debajo de «Promedio por Ronda»
(línea ~391). Título: **«Cómo se escribió»**. Bajada: *registro descriptivo de las rondas
abiertas; no entra en ningún puntaje ni en el ranking*.

Componentes nuevos en `src/components/telemetria/`.

### Arriba: la nube del curso (`NubeEscritura.tsx`)

Un scatter donde cada punto es una respuesta (alumno × ronda).

- eje x: segundos hasta la primera tecla
- eje y: porcentaje del texto final que entró pegado
- **sin nombres a la vista.** El nombre aparece sólo al hacer clic en un punto.
- **todos los puntos del mismo color.** En el mockup los de arriba a la derecha salieron
  naranjos: eso está mal y no se implementa. Pintar de otro color a un grupo es aplicar un
  umbral, o sea clasificar, que es justo lo que este diseño no hace. La nube deja que el ojo
  vea dónde está la masa y dónde no; no dibuja la frontera por ti.

Es la vista que responde la pregunta de fondo: cómo se distribuye el curso, y si esa nube se
mueve entre sesiones. Que nadie aparezca señalado por defecto es intencional: ver el nombre
exige un gesto deliberado.

### Abajo: la rejilla de huellas (`RejillaHuellas.tsx`)

Una fila por alumno, una columna por ronda abierta. Cada celda es una sparkline de ~52×20 px
de cómo creció el texto durante la ronda.

- Una rampa diagonal = fue tecleando.
- Un acantilado vertical = entró un bloque de golpe.
- Un acantilado seguido de rampa = pegó y después lo trabajó.

Sin colores, sin escala de calor, sin etiquetas. La forma se lee sola, y no envejece: si
mañana cambias de opinión sobre qué significa cada forma, el gráfico sigue siendo correcto.

Normalización, que importa para que la comparación signifique algo:

- eje y de cada celda, normalizado al largo final **de esa respuesta** — se compara la forma,
  no el tamaño; una respuesta larga y una corta bien escritas se ven igual;
- eje x, normalizado a la duración de esa ronda, no al largo de la huella. Quien envió al
  minuto 2 de 5 muestra una línea que se corta a la mitad, y eso es información.

Orden por nombre. Se puede reordenar por columna; **no** existe un orden «por sospecha».

Ninguna fila se destaca. En el mockup el nombre de Diego M. salió en naranjo para mostrar el
contraste entre filas; eso tampoco se implementa, por la misma razón que en la nube. Todos los
nombres van del mismo color.

Un guion `—` en las celdas sin respuesta.

### El cajón de detalle (`DetalleRespuesta.tsx`)

Se abre al hacer clic en una celda de la rejilla o en un punto de la nube. Muestra hechos, no
juicios:

```
Diego M. · Ronda 3
Primera tecla            a los 2 min 18 s de los 4 min de ronda
Fuera de la app          41 s antes de escribir (1 salida)
Pegados                  1 · de 782 caracteres · a los 2 min 18 s
Editó después de pegar   0 caracteres
Largo final              782 caracteres
Envió                    a los 2 min 31 s
```

Más la huella completa en grande, y al pie, fijo en la interfaz:

> Nada de esto dice «copió». Dice qué pasó. Puede ser un texto redactado en el bloc de notas,
> y esta pantalla no puede saberlo.

Ese texto no es decorativo: es el recordatorio en pantalla de la regla de arriba, y va en el
componente, no en un comentario.

### Lectura de datos

`getDocs(collection(db, 'games', gameCode, 'telemetria'))` en el `useEffect` que ya carga el
reporte (`ClassReport.tsx:64`). Si la colección viene vacía —juego viejo, anterior a esta
feature— la sección entera no se renderiza. Nada de estados vacíos que expliquen la ausencia.

## Falsos positivos conocidos

Se documentan acá y en el componente porque van a aparecer desde la primera sesión:

**El bloc de notas y el LLM se ven idénticos.** Los dos salen de la app, vuelven y pegan un
bloque. Ninguna señal técnica los separa de forma confiable. Lo que sí está disponible es
señal débil que la huella ya contiene: quien escribió su propio texto suele seguir editándolo
después de pegarlo (`charsEditadosTrasUltimoPegado > 0`); quien lo trajo hecho suele mandarlo
tal cual. Es indicio, no prueba, y el panel no lo convierte en etiqueta.

**La distinción real la da el patrón, no la respuesta suelta.** Una fila con un solo
acantilado en una ronda es alguien que ese día redactó afuera. Una fila con cinco acantilados
es otra cosa. Por eso la rejilla muestra todas las rondas juntas.

**El dictado por voz y el teclado deslizante insertan palabras enteras.** Producen escalones
en la huella que no son pegados. Por eso `pegados[]` se graba del evento `paste` del navegador
y **nunca se infiere de los saltos de la huella**: escalón sin `paste` es dictado o teclado
predictivo; escalón con `paste` es pegado. Esta distinción es la razón de que los dos campos
existan por separado.

**Autocompletado del navegador**: mismo caso que el dictado, y misma defensa.

## Alcance: lo que queda fuera de esta versión

- **`CourseRanking.tsx` no se toca.** Cero telemetría en la tabla acumulada del curso.
- **Nada acumulado entre sesiones.** Es el objetivo final de Naim, pero no se puede diseñar
  antes de ver cómo se ve una sesión real, y leer entre juegos exige una `collectionGroup`
  con reglas nuevas. Primero se juntan tres o cuatro sesiones.
- **Ninguna exportación.** Ni CSV ni PDF ni el `exportSignalsSummary` que ya existe.
- **Ninguna Cloud Function.** No hay nada que desplegar en `functions/`; esto es frontend más
  reglas de Firestore, que sí se despliegan directo desde el directorio del proyecto
  (`npx firebase deploy --only firestore:rules`).
- **Ningún cambio a `NoCopy.tsx`.** Sigue como está, sobre los enunciados.

## Verificación

Testeable con tests automáticos:

- `src/lib/telemetriaDerived.ts` — funciones puras. Casos: huella toda plana, un solo
  acantilado, acantilado con edición posterior, huella vacía, envío antes del primer muestreo,
  respuesta que termina más corta de lo que llegó a ser.

**Verificable sólo jugando**, y es la mayor parte:

- que el `paste` se capture en el teclado de iOS con «Pegar» del menú de mantener apretado —
  que es el camino real en el teléfono, no `Ctrl+V`;
- que `visibilitychange` dispare al cambiar de app en iOS y en Android;
- que el registro se escriba de verdad con las reglas puestas (probar también que un segundo
  alumno no pueda leerlo);
- que un fallo de escritura no rompa el envío: probar con las reglas denegando a propósito;
- que la rejilla se lea con 40 alumnos y 5 rondas sin volverse ilegible.

Esta feature es exactamente del tipo que pasa todos los chequeos automáticos y falla en el
teléfono real. La verificación de verdad es jugar una sesión.

## Orden de implementación sugerido

1. `src/lib/telemetriaDerived.ts` con sus tests.
2. `useTypingTelemetry` + el cambio en `Round.tsx` y `useGame.ts`.
3. La regla de Firestore y su despliegue.
4. Jugar una ronda contra sí mismo y leer el documento resultante en la consola de Firestore.
5. Recién entonces los tres componentes del panel.
