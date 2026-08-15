#!/usr/bin/env Rscript
# El grafico de la ronda 7 de la Clase 3 de Visualizacion de Datos 2026
# (17-ago-2026): la serie de Empleo en la Encuesta CEP.
#
# VA EMPLEO SOLO, y esa es una decision de contenido y no estetica. Se dibujo
# tambien la version con los otros cuatro problemas de la tabla del briefing en
# gris de contexto, y se descarto: ahi la subida de Delincuencia queda a la
# vista, asi que "el empleo pudo bajar porque otro tema subio" -- que es el mejor
# argumento que la ronda persigue -- se LEE del grafico en vez de razonarse. A
# eso se suma que a 310px de telefono cinco lineas grises son pure. Para
# recuperarla: geom_line gris sobre filter(d, serie != "Empleo"), Empleo encima,
# etiquetas directas en el extremo derecho y ylim hasta 35.
#
# Una sola serie, asi que no hay paleta categorica que validar ni leyenda que
# poner: el titulo nombra la serie. El acento es el mismo azul de los graficos
# de la clase 1.
#
# EL HUECO DE 2020 VA VISIBLE Y SIN PUENTE. La CEP no se levanto ese ano, y
# unir la linea por encima afirmaria un dato que no existe -- que es
# exactamente lo que la clase enseno a no hacer. Se fuerza metiendo una fila
# con NA, que es como ggplot corta una linea.
#
# El eje y parte en 0. La clase 1 uso un eje truncado como defecto deliberado y
# la ronda 3 de ese juego pregunta por el; repetirlo aca sin que nadie pregunte
# seria un segundo defecto en un grafico que ya tiene su pregunta.
#
# Fuente: Encuesta CEP, base consolidada 1994-2026, version del curso.
# Es el mismo CSV agregado que los alumnos reciben en el catalogo de fuentes.
#
# Uso (OJO: hay que estar en una ruta bajo /mnt/c, ver README.md de esta carpeta):
#   cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-master-game
#   "/mnt/c/Program Files/R/R-4.3.3/bin/Rscript.exe" \
#       scripts/charts/dataviz_2026/clase_03_dominios_preguntas_fuentes.R

suppressPackageStartupMessages({
  library(ggplot2)
  library(readr)
  library(dplyr)
})

args <- commandArgs(trailingOnly = FALSE)
HERE <- dirname(normalizePath(sub("^--file=", "", grep("^--file=", args, value = TRUE))))
DATA <- file.path(HERE, "data", "cep-problemas-por-anio.csv")
OUT  <- normalizePath(file.path(HERE, "..", "..", "..", "public", "media", "dataviz"),
                      mustWork = FALSE)

CREDIT  <- "Datos: Encuesta CEP, base consolidada 1994-2026 (versión del curso)"
INK     <- "#1f2933"
ACENTO  <- "#2563eb"   # el mismo azul de los graficos de la clase 1
GRID    <- "#dfe3e8"

# El tema de la clase 1, tal cual: los graficos del curso tienen que leerse como
# una sola serie a lo largo del semestre.
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
      # El PNG mide 1100px de ancho y en el telefono se escala a ~28%: 13pt
      # terminarian en ~5px. Si el alumno no puede leer el eje, la ronda no
      # existe.
      axis.text          = element_text(colour = "#52606d", size = 16),
      axis.title.y       = element_text(colour = "#52606d", size = 14),
      axis.title.x       = element_blank(),
      plot.title.position = "plot",
      legend.position    = "none"
    )
}

guardar <- function(p, nombre) {
  dir.create(OUT, recursive = TRUE, showWarnings = FALSE)
  ggsave(file.path(OUT, nombre), p, width = 10, height = 5.6, dpi = 110, bg = "white")
  cat(paste0("  + public/media/dataviz/", nombre, "\n"))
}

crudo <- read_csv(DATA, show_col_types = FALSE)
cat(paste0("Leidas ", nrow(crudo), " filas de ", basename(DATA), "\n"))

# El hueco de 2020, explicito. Una fila con NA es lo que hace que geom_line
# CORTE la linea en vez de puentearla. Si el CSV algun dia trae 2020, el
# stopifnot avisa en vez de dibujar dos puntos encima.
empleo <- crudo |>
  filter(problema == "Empleo") |>
  select(anio, porcentaje) |>
  bind_rows(tibble(anio = 2020L, porcentaje = NA_real_)) |>
  arrange(anio)

stopifnot(
  nrow(empleo) == 33,
  !any(empleo$anio == 2020 & !is.na(empleo$porcentaje))
)

cat(paste0("Empleo: ", sum(!is.na(empleo$porcentaje)), " anios con dato, ",
           "maximo ", max(empleo$porcentaje, na.rm = TRUE), "%, ",
           "minimo ", min(empleo$porcentaje, na.rm = TRUE), "%\n"))

# Las dos cifras que el enunciado de la ronda ya nombra. Se etiquetan para que el
# alumno las ubique en el dibujo; no agregan nada que no este escrito arriba.
#
# El desplazamiento de cada una va a mano y no por vjust comun: la de 2001 cabe
# justo encima del pico, pero la de 2024 puesta arriba se sienta sobre la cola
# que vuelve a subir en 2025-2026 y se lee sobre la linea. Se corre a la
# izquierda para despejarla.
hitos <- filter(empleo, anio %in% c(2001, 2024)) |>
  mutate(
    dx = if_else(anio == 2001, 0, -2.4),
    dy = if_else(anio == 2001, 2.3, 3.0)
  )

ejes <- list(
  scale_x_continuous(breaks = seq(1995, 2025, by = 5)),
  labs(y = "% de menciones", caption = CREDIT)
)

# ── Variante A — Empleo solo ──────────────────────────────────────────────
grafico_a <- ggplot(empleo, aes(anio, porcentaje)) +
  geom_line(colour = ACENTO, linewidth = 1.3) +
  geom_point(data = hitos, colour = ACENTO, size = 3.4) +
  geom_text(
    data = hitos,
    aes(
      x = anio + dx, y = porcentaje + dy,
      label = paste0(format(porcentaje, decimal.mark = ",", trim = TRUE), "%")
    ),
    size = 6.2, fontface = "bold", colour = ACENTO
  ) +
  coord_cartesian(xlim = c(1994, 2026), ylim = c(0, 31), expand = FALSE) +
  ejes +
  labs(
    title    = "Empleo como principal problema del país, 1994-2026",
    subtitle = "% que lo menciona primero. El año 2020 no existe: no se hizo la encuesta"
  ) +
  tema_cancha()
guardar(grafico_a, "c03_cep_empleo.png")
