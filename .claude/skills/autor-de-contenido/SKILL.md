---
name: autor-de-contenido
description: Use when writing or changing the game content of a class session in this repo — "hacer el juego de la clase X", "armar la sesión", "escribir preguntas", "agregar una ronda", "cambiar el enunciado", or creating a new session folder for any course (dataviz_2026, mgt300_2026, ai_democracy_2026, temas_emergentes_2026, ml2-2025). Also use when a game needs questions but nobody has said yet what class material they come from.
---

# Autor de contenido

Escribe las preguntas de un juego a partir del material que el curso realmente
proyecta, **en consulta con Naim y ofreciéndole opciones**, nunca una sola
versión ya decidida.

## La regla que manda sobre todas

**Cada pregunta sale de una slide, página o minuto concreto del material que la
clase vio. El juego no afirma ningún hecho que no esté ahí — tampoco en un
distractor de opción múltiple.**

Si una pregunta necesita un hecho que no está en el material, **se cambia la
pregunta, no se agrega el hecho.** Salió de un juego calificado 3,0/7 donde tres
de las cuatro críticas fueron la misma: "no sé de qué material de clases salió
eso".

Corolario: **nunca escribir una rúbrica o un `judgeFocus` que penalice objetar el
enunciado.** Si un alumno dice "esa premisa suena falsa, ¿de dónde salió?", el
problema es el enunciado.

## Flujo

### 1. Leer el syllabus del curso, no solo el repo

Los programas viven **fuera** de este repo, en
`/mnt/c/Users/naim.bro.k/naimbro.github.io/teaching/`. Ahí están las fechas
reales, los bullets de cada clase y las lecturas asignadas. Leerlo antes de
proponer nada.

El juego y el syllabus pueden divergir legítimamente, pero la divergencia se
nombra en voz alta, no se descubre después.

### 2. Despachar un lector por fuente de material

Una clase puede tener deck + lectura + video. Son lecturas independientes:
**un agente `general-purpose` por fuente, todos en el mismo mensaje**, con el
prompt de `lector-de-material.md` (en esta carpeta) y el `fileId` o la ruta.

Devuelven **fichas de anclaje**: citas textuales con número de slide o página.
No resúmenes. Un resumen que dice "el deck habla de identidad algorítmica" es
justo el insumo que produce una pregunta sin material detrás.

Decks de Google Slides se leen con `read_file_content` del conector de Drive.
**Verificar `modifiedTime`**: un deck del año pasado se ve idéntico a uno
actualizado, y el deck también puede cambiar el mismo día de la clase.

### 3. Mostrar las anclas ANTES de escribir preguntas

Tabla a Naim: qué anclas hay, de qué slide, y qué pregunta permitiría cada una.
**Si el material no da para el juego que el syllabus sugiere, decirlo acá** —
es su decisión de contenido, no tuya.

### 4. Entrevistar

Preguntar, no asumir: cuántas rondas, abiertas o de alternativas, si compite o
no, qué error de los alumnos le interesa cazar, y el largo de respuesta.

### 5. Proponer TRES versiones de cada ronda

Cada una con enunciado, contexto y **el ancla de la que sale**. Distintas de
verdad — distinto ángulo o distinta dificultad, no la misma pregunta
reformulada. Naim elige o mezcla. **Nunca entregar una sola versión.**

### 6. Escribir los archivos

`content/sessions/<curso>/<sesion>/` con `config.json`, `scenarios.json`,
`knowledge_base.md`, `rubric.json`. Esquema exacto y trampas en `esquema.md`.

Las rúbricas por pregunta (`judgeFocus`, `evaluationGuide`, `idealAnswer`) las
escribe el skill **`autor-de-rubricas`**, después de que Naim eligió las
preguntas. No adelantarse: criterios escritos sobre una pregunta que todavía se
puede caer son criterios que no la van a calzar.

### 7. Verificar

```bash
node scripts/validate-content.cjs <courseId>     # estructural
node scripts/verify-session-prompt.cjs <courseId> <sessionId>   # cableado silencioso
npm run build                                     # registro de cursos
```

Los tres pueden pasar sobre un juego que juega mal. **El chequeo que cuenta es
Naim jugándolo en el teléfono.** Decírselo, no darlo por hecho.

## Reglas de escritura

- **Chileno neutro.** Nada de voseo argentino ("elegí", "decime") ni chilenismo
  caricaturizado. Vale para el contenido y para lo que le escribís a Naim.
- **El largo pedido es corto y va escrito en tres lugares**: el enunciado, el
  `globalInstructions` de la rúbrica y el `judgeFocus`. Si sale de uno, los
  jueces empiezan a esperar ensayos.
- **Ojo con el largo**: en la primera clase con curso completo, el límite de
  cuatro líneas fue el tema dominante del feedback. El enunciado pide un largo,
  la rúbrica castiga el relleno, y el formulario no impide pasarse — el alumno
  no sabe si es regla o sugerencia. Si vas a pedir un largo, decidí con Naim
  cuál de las dos cosas es.
- **No rankear auto-reporte.** Preguntar por el dominio de interés, el rol o una
  preferencia no es competencia: rankearlo incentiva escribir la respuesta que
  puntúa en vez de la verdadera. Si todas las rondas van `ranked: false`, el
  podio muestra ceros.
- **El alumno ve la imagen en su teléfono**, no solo proyectada. Un gráfico de
  dos paneles es ilegible ahí.
- El juego es actividad de cierre de clase, 10-15 minutos. No es el abre.

## Errores que ya se cometieron

| Error | Qué pasó |
|---|---|
| Gráfico propio con fuente citada pero no proyectada | Que la fuente esté en una slide no basta: el alumno tiene que haber visto **ese** gráfico |
| Premisa inventada en el enunciado | La rúbrica castigó al alumno que la objetó |
| Distractor inventado entre tres textuales | Delata la pregunta entera |
| `conceptTag` que no calza una sección del `knowledge_base.md` | Los jueces evalúan **sin material y sin dar error** |
| `scenarios.json` envuelto en `{sessionId, scenarios: []}` | El validador lo acepta y `rounds` queda en `undefined` |
| Sesión nueva sin `weightFormula` para los `generic_*` | Los tres jueces quedan indistinguibles, en silencio |
