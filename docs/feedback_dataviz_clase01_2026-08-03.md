# Feedback — Dataviz, clase 1 (3 de agosto de 2026)

Primer juego con un curso completo. Juego `MTF4MX`, sesión `clase_01_diagnostico`,
33 jugadores.

## Notas

**26 de 33 respondieron (79 %).** Todos los que respondieron pusieron nota.

| Nota | Cuántos |
|---|---|
| 7 | 16 |
| 6 | 4 |
| 5 | 6 |

Promedio **6,4**, mediana **7**, piso **5** — ningún 4 o menos.

Participación por ronda: 33 / 32 / 29.

## Comentarios (8 de 26)

### El largo de las respuestas — 3 menciones, y cruza todas las notas

- *"Poder escribir mas en las rondas 2 y 3 porque con 4 líneas me parece poco para poder
  desarrollar ideas correctamente"* — Sergio (5)
- *"Más tiempo para redactar mejor las respuestas"* — Dominique (6)
- *"Muy bueno!! Sin embargo creo que los puntajes son muy severos dado que se entrega un
  máximo de líneas (4) pero no se penaliza pasar el límite. Por lo cual no se puede explayar
  muy bien"* — Fabiana (7)

Fabiana nombra una incoherencia real: el enunciado pide cuatro líneas y la rúbrica castiga el
relleno, pero el formulario no impide pasarse. El alumno no sabe si el límite es regla o
sugerencia.

### La música — 2 menciones independientes

- *"El juego está bien pero la música distrae bastante."* — Catalina (6)
- *"Sin musica"* — Amalia (7)

### Otros

- *"Mejor redacción de preguntas"* — Fernanda (5). Sin detalle.
- *"bkn"* — Gonzalo (7).
- *"Que gemini pueda evaluar"* — L L (7). **No es un capricho, ver abajo.**

## El juez caído

**61 de 183 evaluaciones de rondas abiertas fallaron. Las 61 son de `generic_praxis`**, el
juez que corre sobre Gemini, todas con el mismo error:

```
403 PERMISSION_DENIED: Lightning dunning decision is deny for project: projects/188122257775
```

Es un bloqueo de **facturación** en un proyecto de Google Cloud distinto al del juego
(`ml2-master-game` es el 1031209894901) — probablemente el que Google AI Studio creó solo al
generar la API key. Naim lo está viendo con su banco.

**Praxis no evaluó a nadie en toda la clase.** Cada alumno vio dos jueces con feedback y uno en
blanco.

Esto ofrece una explicación posible para la queja de severidad de Fabiana: Praxis es el juez
del lector no especializado y el que más pondera articulación (0,40) y economía (0,30). Sin él,
el puntaje quedó en manos de los otros dos, que pesan bastante más la fidelidad al texto. No
está comprobado —haría falta recalcular— pero es coherente.

**Sacar 6,4 con un tercio del panel caído es mejor resultado del que parece.**
