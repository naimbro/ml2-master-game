# Clase 14 — Repaso del semestre

Juego largo del lunes 16 de noviembre de 2026, **a las 11:30, después del
recreo** de la clase 14 («Community manager»). **Siete rondas, ~29 min de
pared.** Repasa el semestre entero, de la clase 3 a la de esa misma mañana, y
premia a quien aprendió a lo largo del curso. Nunca jugado.

Es el **estreno de «Probar» dentro de un juego real**: R en vivo (webR) en el
teléfono de cada alumno, en las tres rondas de código.

## De dónde sale cada ronda

| # | Ronda | Formato | Reloj | Ancla |
|---|-------|---------|-------|-------|
| 1 | Diez categorías | alternativas | 65 s | Cuaderno 3, celdas 33–34: 10 categorías que no son 10 temas |
| 2 | ¿Bajó? | alternativas | 64 s | Cuaderno 6, celdas 1 y 35: contar describe, dividir compara |
| 3 | El filtro que miente | código `hard` | 240 s | Cuaderno 4, celdas 45–47 (la trampa) y cuaderno 5, celdas 14–21 (el arreglo) |
| 4 | La torta descartada | alternativas con imagen | 64 s | Lámina 12 de la clase 9 (Roberto Velázquez) |
| 5 | La etapa 3 | código `hard` con imagen | 240 s | Lámina 6 y cuaderno 13, celdas 3–14 |
| 6 | El título que falta | prosa `easy` con imagen | 135 s | Lámina 10 de la clase 9 sin su título; la regla de las clases 6, 8, 9, 10 y 12 |
| 7 | La lámina del carrusel | código `hard` | 255 s | Cuaderno 14, celdas 4–10, y láminas 4–5 de esa mañana |

**Presupuesto:** 1.063 s de relojes (17,7 min) + overhead. El overhead de las
abiertas es de 2 min (medido) y el de las alternativas es 1 min (estimado,
porque no esperan a los jueces): 4 × 2 + 3 × 1 = 11 min. Eso da **~28,7 min**, y
queda margen para un par de «+30 s».

Las tres rondas de código llevan **90 s sobre el piso** de
`relojDerivadoAbierta()` (150 s): 60 s por «Probar», porque con el botón el
alumno itera, y 30 s porque este curso necesitó «+30 s» en las tres rondas de la
clase 8. R7 lleva 15 s más porque son seis líneas.

## El orden y el lobby

**Abrir la sala a las 11:20, en el corte.** R empieza a bajar en el lobby
(≈15 s en escritorio con las dos tablas). Durante el recreo, la descarga se
reparte en diez minutos en vez de caer junta a las 11:30. Además las dos primeras
rondas son de alternativas: la primera de código parte cerca de las 11:35.

**Lo que desplaza:** de 11:30 a 12:00 iban la prueba del scroll y la mitad de
«qué lámina perdió a la sala». Esa decisión es de Naim, no del juego.

## Las decisiones que no son obvias

**Las tablas del teléfono** las deja el bloque `rEnVivo` de `config.json`:
`curso` (encuesta del curso, tal como viene del CSV, con `minutos_viaje` como
texto: la trampa de R3 necesita que siga así), `problemas`
(`cep_problemas_por_anio.csv`, copiado a `public/datos/dataviz/` para esta
sesión) y `delinc`. La CEP consolidada (19 MB) no se usa: por eso no hay ninguna
ronda de código de `facet_grid()`, cuyos ejemplos de la clase 12 dependen de
ella.

**Toda ronda se puede contestar bien sin el botón.** R3 es la lección de las
clases 4 y 5, y R5 copia una imagen. R7 es lo de esa mañana. El botón ayuda a
verificar, no a adivinar.

**Las imágenes son de la clase, recortadas, no rehechas.** Se sacó el panel de
código de la etapa 3 (si no, la respuesta venía escrita), el título de la
mancuerna (que es la respuesta de R6) y el texto con la razón de la lámina 12.
De la lámina 12 queda sólo la torta: la versión con las barras al lado era
ilegible a 375 px. El fondo crema de las láminas no está en el código
proyectado: en el teléfono sale gris, y el enunciado de R5 lo avisa.

**La indulgencia con el paréntesis se mantiene** (decisión de Naim, 15-nov):
quien no pudo cargar R no puede encontrarlo solo. Por lo mismo,
`slice_max(porcentaje, 5)` sin nombrar `n` es nivel 80, no «no corre».

**Todo lo que la rúbrica dice que corre o no corre se corrió en el R del
teléfono** (R 4.6.0, ggplot2 4.0.3, dplyr 1.2.1) el 15-nov, en
`/preview-probar`, que ahora apunta a la config de esta sesión. Los mensajes de
error salen en inglés y no son los del Colab (R 4.4).

## Antes de la clase

- **Corrida en seco** con una sala de prueba y el teléfono de Naim: es la
  primera vez que «Probar» corre dentro de una ronda de verdad. Jugarla con las
  respuestas de `respuestas_sinteticas.md` y mirar si el orden de los puntajes
  sale como ahí.
- Sin probar todavía: iPhone, un Android viejo, y la sala entera bajando R a la
  vez.

## Después de jugar

```bash
npm run diagnostico <CODIGO>
node scripts/judge-levels.cjs
```

**La telemetría de cada ronda de código guarda ahora un campo `r`**
(`telemetria/{uid}_{ronda}.r`): `pruebas`, `errores`, `ultimaOk`, `estado` (cómo
estaba R en ese teléfono al enviar: `listo`, `cargando`, `fallo`) y `msCarga`.
Es el dato que dice **en cuántos teléfonos falló R** y cuánto tardó en cargar.
Lo tiene que leer `diagnostico-de-clase`. Mirar también si los que no tuvieron R
sacaron menos en R3, R5 y R7 que los que sí: si la brecha es grande, la
indulgencia no alcanzó.
