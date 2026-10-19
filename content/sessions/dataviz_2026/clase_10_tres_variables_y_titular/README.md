# Clase 10 — Tres variables y un titular

Juego corto del lunes 19 de octubre de 2026, al cierre de la clase, después de
las exposiciones del ejercicio de redacción. **Dos rondas abiertas, ~8,5 min de
pared.** Nunca jugado. La clase 9 no tuvo juego: el anterior es
`clase_08_primeros_graficos_ggplot` (`4BQHP2`).

Rondas, orden y relojes los eligió Naim (`prompt_juego_clase10.md`, en
`naimbro.github.io/materiales/2026_descripcion_visualizacion_datos/`). La única
fuente es el deck «Tres variables y un titular».

## De dónde sale cada ronda

| # | Ronda | Reloj | Piso | Palabras | Pide | Ancla |
|---|-------|-------|------|----------|------|-------|
| 1 | La tercera variable | 150 s | 105 s | 50 | 1–2 líneas de R | Lámina 4: `ggplot(cuatro, aes(x = anio, y = porcentaje, color = problema)) + geom_line()` |
| 2 | Color o facetas | 120 s | 120 s | 47 | dos líneas de castellano, (1) y (2) | Lámina 6: color para pocos grupos en el mismo eje; facetas para muchos o la forma de cada uno; la prueba de la leyenda |

Presupuesto: **270 s de relojes (4,5 min) + 2 min × 2 rondas = ~8,5 min**.

## Las decisiones que no son obvias

**R1 lleva 45 s sobre el piso.** El diagnóstico de la clase 8 midió que este
curso necesitó «+30 s» en las tres rondas de código; Naim fijó 150 s.

**R2 está clavada en el piso (120 contra 120).** Es `easy` de prosa (una frase
por caso), y el enunciado se recortó a 47 palabras para que cupiera en los 120 s
que pidió Naim. En la clase 8, la ronda con el reloj clavado en el piso fue la
que no alcanzó: si en vivo se ve que el curso sigue escribiendo, «+30 s».

**El molde de la R1 es `ggplot(...) ...`, sin `color` ni `+`**, para no regalar
la caza del día.

**Las variantes de la R1 se corrieron en R 4.3.3 con ggplot2 3.5.2** el
19-oct-2026 (sin `color`, `"problema"` con comillas, `color` fuera de `aes()`,
`%>%`, `group =`, `linetype =`, `facet_wrap(~ problema)`, `colour =`, `aes()`
dentro de `geom_line()`) y viven **sólo en el knowledge base y la rúbrica**,
nunca en un enunciado.

**La R2 no pide código.** «facetas», «paneles» o «un gráfico por problema»
valen igual que `facet_wrap()`. Destacar dos líneas en color sobre el resto en
gris (lámina 8) vale como respuesta del caso (1).

## Después de jugar

```bash
npm run diagnostico <CODIGO>
node scripts/judge-levels.cjs
```

Mirar si la R2 alcanzó con 120 s, y si el par «completa con un error» (55) contra
«dos elecciones sin porqué» (46) quedó en ese orden con los jueces reales.
