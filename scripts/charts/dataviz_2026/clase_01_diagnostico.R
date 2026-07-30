#!/usr/bin/env Rscript
# Los tres graficos de la Clase 1 de Visualizacion de Datos 2026 (03-ago-2026).
#
# Un script por clase; dentro, una funcion por grafico. Los datos salen del CSV
# commiteado en ./data/, nunca de la red: el juego tiene que poder regenerarse
# sin internet y sin que Our World in Data cambie el archivo debajo.
#
# Los graficos 2 y 3 son el MISMO dato dibujado con la MISMA funcion, y difieren
# en exactamente un argumento: los limites de coord_cartesian(). Ese es el
# defecto deliberado del grafico 3, y va solo -- sin titulo alarmista, sin color
# enganoso, sin nada que lo acompane -- porque la ronda 3 pregunta por UN
# problema y tiene que haber una sola respuesta correcta.
#
# Se usa coord_cartesian(ylim=) y NO scale_y_continuous(limits=) a proposito: el
# segundo DESCARTA las observaciones fuera del rango, el primero solo hace zoom.
# Es justamente la distincion que se ensena en clase.
#
# Fuente: Our World in Data, "Life expectancy at birth", Chile 1900-2023.
# Licencia CC BY 4.0.  https://ourworldindata.org/grapher/life-expectancy
#
# Uso (OJO: hay que estar en una ruta bajo /mnt/c, ver scripts/charts/dataviz_2026/README.md):
#   cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-master-game
#   "/mnt/c/Program Files/R/R-4.3.3/bin/Rscript.exe" \
#       scripts/charts/dataviz_2026/clase_01_diagnostico.R

suppressPackageStartupMessages({
  library(ggplot2)
  library(readr)
  library(dplyr)
})

# Las rutas se derivan de --file= y no de getwd(): Rscript.exe resuelve las
# rutas relativas contra el directorio desde el que se lo invoco, asi que el
# script tiene que ubicarse a si mismo para encontrar sus datos.
args <- commandArgs(trailingOnly = FALSE)
HERE <- dirname(normalizePath(sub("^--file=", "", grep("^--file=", args, value = TRUE))))
DATA <- file.path(HERE, "data", "owid-life-expectancy-chile.csv")
OUT  <- normalizePath(file.path(HERE, "..", "..", "..", "public", "media", "dataviz"),
                      mustWork = FALSE)

CREDIT <- "Datos: Our World in Data (CC BY 4.0)"
INK  <- "#1f2933"
LINE <- "#2563eb"
GRID <- "#dfe3e8"

# El tema comun, para que los tres graficos se lean como una sola serie.
tema_cancha <- function() {
  theme_minimal(base_size = 13) +
    theme(
      plot.background    = element_rect(fill = "white", colour = NA),
      panel.background   = element_rect(fill = "white", colour = NA),
      plot.title         = element_text(size = 20, face = "bold", colour = INK,
                                        hjust = 0, margin = margin(b = 6)),
      plot.subtitle      = element_text(size = 13, colour = "#52606d",
                                        margin = margin(b = 14)),
      plot.caption       = element_text(size = 11, colour = "#7b8794", hjust = 1),
      panel.grid.major.y = element_line(colour = GRID, linewidth = 0.5),
      panel.grid.major.x = element_blank(),
      panel.grid.minor   = element_blank(),
      axis.line.x        = element_line(colour = GRID),
      axis.line.y        = element_line(colour = GRID),
      # El PNG mide 1100px de ancho y en un telefono se escala a ~35%, asi que
      # 13pt terminaban en ~6px en pantalla: ilegibles. Las rondas 1 a 3 se caen
      # si el alumno no puede leer el eje, asi que el texto va deliberadamente
      # grande respecto del grafico.
      axis.text          = element_text(colour = "#52606d", size = 16),
      axis.title.y       = element_text(colour = "#52606d", size = 14),
      axis.title.x       = element_blank(),
      plot.title.position = "plot"
    )
}

guardar <- function(p, nombre) {
  dir.create(OUT, recursive = TRUE, showWarnings = FALSE)
  ggsave(file.path(OUT, nombre), p, width = 10, height = 5.6, dpi = 110,
         bg = "white")
  cat(paste0("  + public/media/dataviz/", nombre, "\n"))
}

d <- read_csv(DATA, show_col_types = FALSE) |>
  select(year, value = life_expectancy_0)
cat(paste0("Leidas ", nrow(d), " filas de ", basename(DATA), "\n"))

# Grafico A -- ronda 1. Honesto, serie completa, eje y desde 0.
# El eje parte en 0 a proposito: la ronda 1 pregunta por el TAMANO del cambio, y
# con el eje en 0 el aumento se lee directamente de la altura.
grafico_siglo <- ggplot(d, aes(year, value)) +
  geom_line(colour = LINE, linewidth = 1.1) +
  scale_x_continuous(breaks = seq(1900, 2020, by = 20)) +
  coord_cartesian(xlim = c(1900, 2023), ylim = c(0, 90), expand = FALSE) +
  labs(
    title    = "Esperanza de vida al nacer en Chile, 1900-2023",
    subtitle = "Años que se espera que viva una persona nacida ese año",
    y        = "Años",
    caption  = CREDIT
  ) +
  tema_cancha()
guardar(grafico_siglo, "c01_esperanza_vida_siglo.png")

# Graficos B y C -- rondas 2, 3 y 5. Mismo dato, misma funcion.
# `ylim` es la unica diferencia, y en el grafico C es el defecto deliberado: con
# el eje entre 78 y 82, una caida de 1,4 anos ocupa media figura.
grafico_reciente <- function(ylim) {
  ggplot(filter(d, year >= 2010), aes(year, value)) +
    geom_line(colour = LINE, linewidth = 1.1) +
    geom_point(colour = LINE, size = 2.2) +
    scale_x_continuous(breaks = seq(2010, 2022, by = 2)) +
    coord_cartesian(xlim = c(2010, 2023), ylim = ylim, expand = FALSE) +
    labs(
      title    = "Esperanza de vida al nacer en Chile, 2010-2023",
      subtitle = "Años que se espera que viva una persona nacida ese año",
      y        = "Años",
      caption  = CREDIT
    ) +
    tema_cancha()
}

guardar(grafico_reciente(c(0, 90)),  "c01_esperanza_vida_reciente.png")
guardar(grafico_reciente(c(78, 82)), "c01_esperanza_vida_eje_truncado.png")
