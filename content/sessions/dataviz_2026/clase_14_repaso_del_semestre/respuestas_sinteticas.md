# Respuestas sintéticas — clase 14, repaso del semestre (versión de editar)

Para la **corrida en seco**: se juega la sesión con una sala de prueba y en cada
ronda se manda a propósito una de estas respuestas. Así se calibra la rúbrica
con los jueces desplegados, sin pedir ninguna clave de API (ver CLAUDE.md).

Cada ronda empieza con el código ya escrito en el cuadro. Las respuestas de
abajo son **el cuadro completo después de editarlo**: se escriben encima de lo
que viene.

El puntaje es la **predicción** de la rúbrica con la fórmula del juez
especialista (0,75 · exactitud + 0,15 · completitud + 0,10 · claridad) y las
penalizaciones apagadas. Lo que hay que mirar al jugar es si el **orden** sale
así: sin editar < con un error < cercana < buena ≈ de al lado.

Con una sola cuenta, en cada ronda mandar la del **borde** (la marcada ★): es la
que dice si la rúbrica distingue.

Todo se corrió en el R del teléfono (webR, R 4.6.0) el 15-nov-2026.

| Ronda | Buena (100) | De al lado (100) | ★ Borde | Sin editar |
|---|---|---|---|---|
| R1 Ver la tabla | `curso` | `head(curso)` | `"curso"` entre comillas: imprime la palabra (55) | sólo el comentario (≤28) |
| R2 Contar | `count(curso, sistema_operativo)` | `table(curso$sistema_operativo)` | `count(curso, sistema operativo)`: no corre (55) | `count(curso, transporte)` (≤28) |
| R3 Filtrar | `filter(transporte != "Auto")` | `filter(transporte %in% c("Metro", "Micro o bus"))` | `!= "auto"` en minúscula: devuelve las 33 (55) | `== "Metro"` (≤28) |
| R4 El filtro que miente | agregar `mutate(minutos_viaje = as.numeric(minutos_viaje)) %>%` | `mutate(minutos_num = ...)` y cambiar `filter` y `count` a `minutos_num` | `mutate(minutos_num = ...)` sin tocar el `filter`: sigue dando diez (55) | el cuadro tal cual (≤28) |
| R5 El promedio que no sale | `mean(minutos_num, na.rm = TRUE)` | `filter(!is.na(minutos_num))` antes del `group_by` | `summarise(minutos = mean(minutos_num), na.rm = TRUE)`: Auto sigue en NA (55) | el cuadro tal cual (≤28) |
| R6 El gráfico que no corre | `%>%` → `+` al final de la línea | — | el `+` al comienzo de la línea siguiente: no corre (85) | el cuadro tal cual (≤28) |
| R7 Una línea por problema | `aes(x = anio, y = porcentaje, color = problema)` | `geom_line(aes(color = problema))` | `aes(..., group = problema)`: cuatro líneas de un color (70) | el cuadro tal cual (≤28) |
| R8 El número en la barra | `+ geom_text(aes(label = paste0(round(porcentaje), "%")), nudge_x = 2)` | `+ geom_text(aes(label = porcentaje))` | `+ geom_text(label = porcentaje)`: no corre (55) | el cuadro tal cual (≤28) |

## Si alguno sale dado vuelta

Se arregla en el ancla de nivel o en el `judgeFocus` de esa ronda, no subiendo
una penalización: las penalizaciones se disparan en menos del 4% de las
evaluaciones.
