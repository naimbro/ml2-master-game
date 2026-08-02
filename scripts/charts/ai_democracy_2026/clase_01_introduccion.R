#!/usr/bin/env Rscript
# Los dos graficos de la Clase 1 de IA y Democracia 2026 (03-ago-2026).
#
# Ninguno de los dos imita el grafico original de su fuente. Los dos dibujan
# SOLO los valores que la fuente reporta en su texto o en sus tablas, porque
# reconstruir un scatterplot binned a partir de dos puntos citados seria
# inventar la forma de la nube. Lo que la ronda pregunta es la DIRECCION de la
# relacion, y para eso los valores publicados bastan.
#
# Los datos van hardcodeados aca y no en un CSV: son diez numeros sacados a mano
# de dos PDFs, no una serie descargable. El CSV de dataviz existe porque OWID
# puede cambiar el archivo debajo; aca la fuente es un paper congelado.
#
# Fuentes:
#   Grafico 1 — Anthropic Economic Index: Economic Primitives (15-ene-2026),
#     seccion "Tradeoffs in task acceleration", texto de la figura 4.1.
#   Grafico 2 — Eloundou, Manning, Mishkin y Rock (2023), "GPTs are GPTs",
#     arXiv:2303.10130, Tabla 4 (medida Human beta) y Tabla 11.
#
# Uso (OJO: hay que estar en una ruta bajo /mnt/c, ver el README de dataviz):
#   cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-master-game
#   "/mnt/c/Program Files/R/R-4.3.3/bin/Rscript.exe" \
#       scripts/charts/ai_democracy_2026/clase_01_introduccion.R

suppressPackageStartupMessages({
  library(ggplot2)
  library(dplyr)
})

args <- commandArgs(trailingOnly = FALSE)
HERE <- dirname(normalizePath(sub("^--file=", "", grep("^--file=", args, value = TRUE))))
OUT  <- normalizePath(file.path(HERE, "..", "..", "..", "public", "media", "ai_democracy"),
                      mustWork = FALSE)
dir.create(OUT, showWarnings = FALSE, recursive = TRUE)

INK    <- "#1f2933"
MUTED  <- "#52606d"
GRID   <- "#dfe3e8"
AZUL   <- "#2563eb"
AMBAR  <- "#b45309"

# Mismo tema que los graficos de dataviz, para que todos los graficos del
# juego se lean como una sola familia visual.
tema_cancha <- function() {
  theme_minimal(base_size = 13) +
    theme(
      plot.background    = element_rect(fill = "white", colour = NA),
      panel.background   = element_rect(fill = "white", colour = NA),
      plot.title         = element_text(size = 20, face = "bold", colour = INK,
                                        hjust = 0, margin = margin(b = 6)),
      plot.subtitle      = element_text(size = 13, colour = MUTED,
                                        margin = margin(b = 14)),
      plot.caption       = element_text(size = 10, colour = "#7b8794", hjust = 1),
      strip.text         = element_text(size = 13, face = "bold", colour = INK,
                                        margin = margin(b = 8)),
      panel.grid.major.y = element_line(colour = GRID, linewidth = 0.5),
      panel.grid.major.x = element_blank(),
      panel.grid.minor   = element_blank(),
      axis.line.x        = element_line(colour = GRID),
      axis.text          = element_text(colour = MUTED, size = 12),
      axis.title         = element_text(colour = MUTED, size = 12),
      legend.position    = "none",
      # Titulo y credito alineados a la FIGURA y no al panel: con coord_flip las
      # etiquetas del eje se comen el ancho del panel y el titulo se truncaba.
      plot.title.position   = "plot",
      plot.caption.position = "plot"
    )
}

guardar <- function(p, nombre, height = 5.6) {
  ggsave(file.path(OUT, nombre), p, width = 10, height = height, dpi = 110,
         bg = "white")
  message("  -> ", file.path(OUT, nombre))
}

# ---------------------------------------------------------------------------
# Grafico 1 — El gradiente de Anthropic.
#
# Dos paneles que van en direcciones opuestas: la IA acelera MAS las tareas mas
# exigentes, y a la vez ACIERTA MENOS en ellas. La ronda 1 pregunta que dice el
# grafico, y el distractor bueno es leer el eje x como "cuanto sabe la persona"
# cuando mide "cuanta escolaridad exige la tarea".
# ---------------------------------------------------------------------------
grafico_gradiente <- function() {
  # Los dos paneles arrancan en CERO a proposito. Con escala libre y sin cero,
  # la caida de 70% a 66% se dibuja tan alta como el alza de 9x a 12x, y el
  # grafico miente sobre la magnitud del tradeoff: la aceleracion sube un tercio
  # y el exito baja cuatro puntos. Ademas seria incoherente ensenar a detectar
  # ejes truncados en el otro curso y usar uno aca.
  d <- bind_rows(
    tibble::tibble(
      panel = "1. Cuanto acelera la IA la tarea",
      x     = c(1, 2),
      valor = c(9, 12),
      tope  = 14,
      etiqueta = c("9x mas rapido", "12x mas rapido")
    ),
    tibble::tibble(
      panel = "2. Cuantas veces le sale bien",
      x     = c(1, 2),
      valor = c(70, 66),
      tope  = 100,
      etiqueta = c("70% de exito", "66% de exito")
    )
  )

  ggplot(d, aes(x = x, y = valor)) +
    geom_blank(aes(y = tope)) +
    geom_line(colour = AZUL, linewidth = 1.2) +
    geom_point(colour = AZUL, size = 5) +
    geom_text(aes(label = etiqueta), vjust = -1.3, colour = INK,
              size = 4.6, fontface = "bold") +
    facet_wrap(~panel, scales = "free_y") +
    scale_x_continuous(breaks = c(1, 2),
                       labels = c("Tarea de nivel\nescolar (12 anos)",
                                  "Tarea de nivel\nuniversitario (16 anos)"),
                       limits = c(0.55, 2.45)) +
    scale_y_continuous(limits = c(0, NA), expand = expansion(mult = c(0, 0.1))) +
    labs(
      title    = "Que le pasa a la IA cuando la tarea se pone mas exigente",
      subtitle = "Escolaridad que exige la TAREA, no la que tiene la persona que la pide",
      x = NULL, y = NULL,
      caption  = "Datos: Anthropic Economic Index — Economic Primitives (enero 2026), figura 4.1"
    ) +
    tema_cancha()
}

# ---------------------------------------------------------------------------
# Grafico 2 — Que ocupaciones estan expuestas.
#
# Las cinco mas expuestas segun la medida Human beta de la Tabla 4, y cinco de
# las 34 ocupaciones de la Tabla 11 que no tienen NINGUNA tarea expuesta. Las
# cinco de arriba son las cinco reales, sin elegir a dedo: "cientificos
# pecuarios" queda dentro aunque descoloque, porque sacarlo seria maquillar el
# dato. Las cinco de abajo si son una seleccion de las 34, y el subtitulo lo
# dice.
# ---------------------------------------------------------------------------
grafico_ocupaciones <- function() {
  d <- tibble::tibble(
    ocupacion = c(
      "Investigadores de encuestas",
      "Escritores y autores",
      "Interpretes y traductores",
      "Relacionadores publicos",
      "Cientificos pecuarios",
      "Operadores de maquinaria agricola",
      "Mecanicos de motos",
      "Lavaplatos",
      "Ayudantes de techadores",
      "Albaniles de piedra"
    ),
    exposicion = c(84.4, 82.5, 82.4, 80.6, 77.8, 0, 0, 0, 0, 0),
    grupo = c(rep("expuesta", 5), rep("cero", 5))
  ) |>
    mutate(ocupacion = factor(ocupacion, levels = rev(ocupacion)))

  ggplot(d, aes(x = ocupacion, y = exposicion, fill = grupo)) +
    geom_col(width = 0.72) +
    geom_text(aes(label = paste0(round(exposicion), "%")),
              hjust = -0.25, colour = INK, size = 4.4, fontface = "bold") +
    scale_fill_manual(values = c(expuesta = AMBAR, cero = AZUL)) +
    scale_y_continuous(limits = c(0, 100), expand = expansion(mult = c(0, 0.02))) +
    coord_flip() +
    labs(
      title    = "Que ocupaciones estan expuestas a la IA generativa",
      subtitle = "Las cinco mas expuestas, y cinco de las 34 sin ninguna tarea expuesta",
      x = NULL, y = "% de las tareas de la ocupacion",
      caption  = "Datos: Eloundou, Manning, Mishkin y Rock (2023), \"GPTs are GPTs\", tablas 4 y 11"
    ) +
    tema_cancha() +
    theme(panel.grid.major.y = element_blank(),
          panel.grid.major.x = element_line(colour = GRID, linewidth = 0.5))
}

message("Generando graficos de IA y Democracia — clase 1...")
guardar(grafico_gradiente(),   "c01_gradiente_anthropic.png", height = 5.2)
guardar(grafico_ocupaciones(), "c01_exposicion_ocupaciones.png", height = 6.0)
message("Listo.")
